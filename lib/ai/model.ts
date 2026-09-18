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

/** Balanced tier of the current GPT-5.6 family (intelligence vs cost). */
export const DEFAULT_MODEL_ID = "gpt-5.6-terra";

export function getModelId(): string {
  return process.env.MODEL_ID || DEFAULT_MODEL_ID;
}

export function getModel(): LanguageModelV1 {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set (needed for the conversation model and embeddings).");
  }
  const openai = createOpenAI({ apiKey });
  return openai.responses(getModelId());
}
