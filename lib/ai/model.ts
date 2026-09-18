/**
 * Conversation model client (server-only).
 *
 * The concrete Claude model is chosen via MODEL_ID so it can be upgraded without
 * code changes. Nothing else in the app references a model id directly.
 */
import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModelV1 } from "ai";

export const DEFAULT_MODEL_ID = "claude-sonnet-4-5";

export function getModelId(): string {
  return process.env.MODEL_ID ?? DEFAULT_MODEL_ID;
}

export function getModel(): LanguageModelV1 {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set (needed for the conversation model).");
  }
  const anthropic = createAnthropic({ apiKey });
  return anthropic(getModelId());
}
