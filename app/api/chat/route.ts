/**
 * POST /api/chat — the core streaming chat endpoint.
 *
 * Flow (see CLAUDE.md → "Chat request flow"):
 *  1. Resolve the pinned event from server config (never from the client).
 *  2. Validate the body (Zod). A client-supplied conversationId is only an
 *     attachment key; if the conversation exists it must belong to this event.
 *  3. Retrieve approved, in-date KB for this event + evergreen.
 *  4. Build the grounded system prompt and stream with event-scoped tools.
 *  5. On finish: grounding check + posture logging + persistence.
 *
 * Visitor turns are wrapped as untrusted data. Hard facts only ever reach the
 * model through tools. Nothing here can select another event.
 */
import { streamText, type Message } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { retrieve } from "@/lib/kb/retrieve";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getChatProviderOptions, getModel } from "@/lib/ai/model";
import { makeTools } from "@/lib/ai/tools";
import {
  detectPromptInjection,
  detectUnverifiedClaim,
  groundingCheck,
  needsKnowledgeRetrieval,
  sanitizeUserText,
  wrapUntrustedUserContent,
} from "@/lib/ai/guardrails";
import type { RetrievedChunk, ToolContext } from "@/lib/types";

export const runtime = "nodejs"; // postgres.js + server-only need Node, not Edge
export const maxDuration = 30;

const MAX_MESSAGES = 80;
const MAX_CONTENT_CHARS = 20_000;

// UI message parts from useChat are passed through loosely; only the shapes we
// actively keep (text / completed tool invocations / step markers) survive.
const partSchema = z.object({ type: z.string() }).passthrough();

const incomingMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_CONTENT_CHARS).default(""),
  parts: z.array(partSchema).max(50).optional(),
});

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(incomingMessageSchema).min(1).max(MAX_MESSAGES),
});

type IncomingMessage = z.infer<typeof incomingMessageSchema>;
type ModelMessage = Omit<Message, "id">;

function textFromParts(parts: IncomingMessage["parts"]): string {
  return (parts ?? [])
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}

/**
 * Convert the client's UI messages into what the model sees. Every visitor
 * turn is wrapped as data; assistant turns keep completed tool invocations so
 * multi-turn tool context survives, and empty assistant turns are dropped
 * (providers reject empty assistant text blocks).
 */
function toModelMessages(incoming: IncomingMessage[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const m of incoming) {
    if (m.role === "user") {
      const text = sanitizeUserText(m.content || textFromParts(m.parts));
      if (!text) continue;
      out.push({ role: "user", content: wrapUntrustedUserContent(text) });
      continue;
    }
    const parts = (m.parts ?? []).filter((p) => {
      if (p.type === "text") return typeof p.text === "string" && p.text.trim().length > 0;
      if (p.type === "tool-invocation") {
        const inv = p.toolInvocation as { state?: string } | undefined;
        return inv?.state === "result";
      }
      return p.type === "step-start";
    });
    const hasContent = parts.some((p) => p.type !== "step-start");
    if (hasContent) {
      out.push({
        role: "assistant",
        content: m.content,
        parts: parts as unknown as Message["parts"],
      });
    } else if (m.content.trim()) {
      out.push({ role: "assistant", content: m.content });
    }
  }
  return out;
}

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    // 1. The pinned event — server config only.
    const event = await getActiveEvent();

    // 2. Conversation attachment. The id is a client-generated uuid so turns
    //    attach to one row; it is not a capability (all queries are event-scoped)
    //    but an existing conversation must still belong to THIS event.
    const convId = body.conversationId ?? crypto.randomUUID();
    const [existing] = await db
      .select({ eventId: conversations.eventId })
      .from(conversations)
      .where(eq(conversations.id, convId))
      .limit(1);
    if (existing) {
      if (existing.eventId !== event.id) {
        return Response.json({ error: "Conversation does not belong to this event." }, { status: 403 });
      }
    } else {
      await db
        .insert(conversations)
        .values({ id: convId, eventId: event.id, status: "open" })
        .onConflictDoNothing();
    }

    const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
    const lastText = sanitizeUserText(lastUser?.content || textFromParts(lastUser?.parts));
    if (!lastText) {
      return Response.json({ error: "A user message is required." }, { status: 400 });
    }

    // Posture logging: we do not block on these — the prompt + tools steer the
    // reply — but we record that an attempt was made.
    const injection = detectPromptInjection(lastText);
    const claim = detectUnverifiedClaim(lastText);
    if (injection.injected || claim.claim) {
      console.info("[chat] posture", {
        conversationId: convId,
        injection: injection.matches,
        unverifiedClaim: claim.matches,
      });
    }

    // 3. Retrieval — scoped + approved + in-date. Skipped for trivial turns
    //    (greetings, short routing) to save an embed + vector round-trip; this
    //    is latency-only and never changes what's allowed — hard facts still
    //    come from tools. If embeddings are down the turn still works from tools
    //    alone; the model just sees no CONTEXT.
    let context: RetrievedChunk[] = [];
    if (needsKnowledgeRetrieval(lastText)) {
      try {
        context = await retrieve({ eventId: event.id, query: lastText });
      } catch (err) {
        console.error("[chat] retrieval failed; continuing with empty context", err);
      }
    }

    // 4. Prompt + tools, both bound to this event.
    const system = buildSystemPrompt({ event, context });
    const modelMessages = toModelMessages(body.messages);
    const ctx: ToolContext = { event, eventId: event.id, conversationId: convId };

    const result = streamText({
      model: getModel(),
      system,
      messages: modelMessages,
      tools: makeTools(ctx),
      // One tool round then answer is the common path; 3 leaves headroom for a
      // dependent second round (e.g. facts → form) without inviting long
      // multi-step loops. The model is told to batch tool calls in parallel.
      maxSteps: 3,
      // Fast tier + low reasoning effort for latency; strictSchemas:false
      // because our tools have optional args (Zod validates them server-side).
      providerOptions: getChatProviderOptions(),
      // The data stream masks errors from the visitor (see getErrorMessage
      // below); log the real one server-side so failures are diagnosable.
      onError({ error }) {
        console.error("[chat] stream error", { conversationId: convId, error });
      },
      async onFinish({ text, steps }) {
        // Tool results are typed per-tool by the SDK; with a dynamic tool set
        // they collapse to `never`, so read the generic shape explicitly.
        type AnyToolResult = { toolName: string; args: unknown; result: unknown };
        const toolActivity = steps.flatMap((s) =>
          (s.toolResults as AnyToolResult[]).map((r) => ({
            tool: r.toolName,
            args: r.args,
            result: r.result,
          })),
        );

        // 5a. Grounding: any date/number/currency in the reply must appear in a
        //     source the model was given (KB context, tool results, event
        //     identity) or in the visitor's own words.
        const sources = [
          ...context.map((c) => c.content),
          JSON.stringify(toolActivity),
          event.name,
          event.slug,
          String(event.year),
          lastText,
        ];
        const grounding = groundingCheck(text, sources);
        if (!grounding.ok) {
          console.warn("[grounding] unsourced fact-like tokens", {
            conversationId: convId,
            flags: grounding.flags,
          });
          // TODO(phase-2): stricter mode — regenerate with a grounding
          // instruction instead of only logging.
        }

        // 5b. Persist the turn (raw visitor text, not the wrapped form).
        try {
          await db.insert(messages).values([
            { conversationId: convId, role: "user", content: lastText },
            {
              conversationId: convId,
              role: "assistant",
              content: text,
              toolCalls: toolActivity.length ? toolActivity : null,
            },
          ]);
        } catch (err) {
          console.error("[chat] failed to persist messages", err);
        }
      },
    });

    return result.toDataStreamResponse({
      headers: { "x-conversation-id": convId },
      getErrorMessage: () =>
        "The assistant hit a problem. Please try again, or ask to speak with the team.",
    });
  } catch (err) {
    console.error("[chat] request failed", err);
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 500 });
  }
}
