/**
 * Embeddings provider wrapper (server-only).
 *
 * The rest of the app depends on the `EmbeddingsProvider` interface, never on a
 * concrete SDK, so the provider can be swapped via EMBEDDINGS_PROVIDER without
 * touching call sites. v1 ships an OpenAI provider (text-embedding-3-small).
 */
import "server-only";
import OpenAI from "openai";
import { EMBEDDING_DIM } from "@/lib/db/schema";

export interface EmbeddingsProvider {
  readonly name: string;
  readonly dim: number;
  embedMany(texts: string[]): Promise<number[][]>;
}

/** Convenience: embed a single string. */
export async function embed(text: string): Promise<number[]> {
  const [vector] = await getEmbeddingsProvider().embedMany([text]);
  return vector!;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  return getEmbeddingsProvider().embedMany(texts);
}

let cached: EmbeddingsProvider | null = null;

export function getEmbeddingsProvider(): EmbeddingsProvider {
  if (cached) return cached;
  const provider = (process.env.EMBEDDINGS_PROVIDER ?? "openai").toLowerCase();
  switch (provider) {
    case "openai":
      cached = createOpenAIProvider();
      return cached;
    // Add future providers here (cohere, voyage, local, ...). Keep the same
    // interface so nothing else changes.
    default:
      throw new Error(`Unsupported EMBEDDINGS_PROVIDER: ${provider}`);
  }
}

function createOpenAIProvider(): EmbeddingsProvider {
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const dim = EMBEDDING_DIM;
  let client: OpenAI | null = null;

  function getClient(): OpenAI {
    if (client) return client;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set (needed for embeddings).");
    client = new OpenAI({ apiKey });
    return client;
  }

  return {
    name: `openai:${model}`,
    dim,
    async embedMany(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const res = await getClient().embeddings.create({
        model,
        input: texts,
        dimensions: dim,
      });
      // Preserve input order.
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding as number[]);
    },
  };
}
