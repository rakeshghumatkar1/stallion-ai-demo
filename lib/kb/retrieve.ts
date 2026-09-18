/**
 * UAE-only knowledge retrieval for the production demo.
 *
 * Knowledge is shipped with the application from the approved Drive-derived
 * UAE package. There is no database/vector lookup here, so old India rows,
 * evergreen rows and other events are technically unreachable.
 */
import "server-only";
import { UAE_KNOWLEDGE_SECTIONS } from "@/lib/demo/uae-knowledge";
import type { RetrievedChunk } from "@/lib/types";

export interface RetrieveOptions {
  eventId: string;
  query: string;
  limit?: number;
  minScore?: number;
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export async function retrieve(opts: RetrieveOptions): Promise<RetrievedChunk[]> {
  const query = opts.query.trim();
  if (!query) return [];

  const q = tokens(query);
  const limit = opts.limit ?? 4;

  const ranked = UAE_KNOWLEDGE_SECTIONS.map((section, index) => {
    const keywordScore = section.keywords.reduce(
      (score, keyword) => score + (q.has(keyword.toLowerCase()) || query.toLowerCase().includes(keyword.toLowerCase()) ? 3 : 0),
      0,
    );
    const titleScore = [...tokens(section.title)].reduce((score, word) => score + (q.has(word) ? 1 : 0), 0);
    return { section, score: keywordScore + titleScore, index };
  })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const positive = ranked.filter((r) => r.score > 0);
  const selected = (positive.length ? positive : ranked.slice(0, 2)).slice(0, limit);

  return selected.map(({ section, score }) => ({
    id: section.id,
    content: section.content,
    score: score || 0.1,
    documentTitle: section.title,
    source:
      "Google Drive: 03 - Stallion AI Assistant - Edition Configuration - UAE Test",
    scope: "event",
    sourceType: "edition_config",
    provisional: false,
  }));
}

export function hasRelevant(chunks: RetrievedChunk[]): boolean {
  return chunks.length > 0;
}
