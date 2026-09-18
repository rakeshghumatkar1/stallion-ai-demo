/**
 * Conversation model client (server-only).
 *
 * Single provider: OpenAI serves both the chat model (here) and embeddings
 * (lib/kb/embed.ts), so one key — OPENAI_API_KEY — runs the whole app. The
 * concrete model is chosen via MODEL_ID so it can be upgraded without code
 * changes; nothing else in the app references a model id.
 *
 * The GPT-5.x family is served through the OpenAI Responses API, so we use the
 * provider's `responses()` factory rather than chat completions. Streaming and
 * tool calling are provider-neutral in the AI SDK, so the chat route and tools
 * are untouched by this choice.
 */
import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

/**
 * Fast/low-cost tier of the current GPT-5.6 family (Sol=flagship,
 * Terra=balanced, Luna=fast/cheap). This assistant does FAQ + routing, not hard
 * reasoning, so the fast tier is the right default; upgrade via MODEL_ID only if
 * a measurable quality gap appears. See https://developers.openai.com/api/docs/models.
 */
export const DEFAULT_MODEL_ID = "gpt-5.6-luna";

/** Reasoning effort for the GPT-5.6 family: none|low|medium|high|xhigh|max. */
export type ReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";
const VALID_EFFORTS: ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh", "max"];

/**
 * Low by default: this is FAQ/routing over grounded facts, not hard reasoning,
 * so we spend minimal reasoning tokens for latency. Override with
 * MODEL_REASONING_EFFORT if a turn type ever needs more.
 */
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "low";

export function getModelId(): string {
  return process.env.MODEL_ID || DEFAULT_MODEL_ID;
}

export function getReasoningEffort(): ReasoningEffort {
  const raw = (process.env.MODEL_REASONING_EFFORT ?? "").toLowerCase();
  return (VALID_EFFORTS as string[]).includes(raw)
    ? (raw as ReasoningEffort)
    : DEFAULT_REASONING_EFFORT;
}

/**
 * Provider options for the chat call. Kept here so the model config lives in one
 * place. `reasoningEffort` trims latency; `strictSchemas:false` is required
 * because our tools have optional args (validated server-side by Zod anyway).
 */
export function getChatProviderOptions() {
  return {
    openai: {
      reasoningEffort: getReasoningEffort(),
      strictSchemas: false,
    },
  } as const;
}

export function getModel(): LanguageModelV1 {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set (needed for the conversation model and embeddings).");
  }
  const openai = createOpenAI({ apiKey });
  return openai.responses(getModelId());
}
