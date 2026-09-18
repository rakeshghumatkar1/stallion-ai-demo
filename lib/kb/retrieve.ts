/**
 * Vector retrieval (server-only) — ALWAYS event-filtered and approval-filtered.
 *
 * The filter enforced here IS the safety boundary. On every read the model can
 * reach, retrieval only returns chunks whose document is:
 *   (event_id = ACTIVE_EVENT_ID OR scope = 'evergreen')
 *   AND active = true
 *   AND approval_status = 'approved'
 *   AND (effective_date IS NULL OR effective_date <= now)
 *   AND (expiry_date  IS NULL OR expiry_date  >= now)
 *
 * There is no code path here that can return another event's content, draft
 * content, inactive content, or out-of-date content. This is core to isolation.
 */
import "server-only";
import { and, cosineDistance, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbChunks, kbDocuments, type ChunkMetadata } from "@/lib/db/schema";
import { embed } from "@/lib/kb/embed";
import type { RetrievedChunk } from "@/lib/types";

export interface RetrieveOptions {
  eventId: string;
  query: string;
  limit?: number;
  /** Minimum cosine similarity (0..1) for a chunk to count as relevant. */
  minScore?: number;
}

export async function retrieve(opts: RetrieveOptions): Promise<RetrievedChunk[]> {
  const { eventId, query } = opts;
  const limit = opts.limit ?? 6;
  const minScore = opts.minScore ?? 0.2;
  const now = new Date();

  if (!query.trim()) return [];

  const queryVector = await embed(query);
  const similarity = sql<number>`1 - (${cosineDistance(kbChunks.embedding, queryVector)})`;

  const rows = await db
    .select({
      id: kbChunks.id,
      content: kbChunks.content,
      scope: kbChunks.scope,
      metadata: kbChunks.metadata,
      score: similarity,
    })
    .from(kbChunks)
    .innerJoin(kbDocuments, eq(kbChunks.documentId, kbDocuments.id))
    .where(
      and(
        // Event isolation: this event OR evergreen. Nothing else.
        or(eq(kbDocuments.eventId, eventId), eq(kbDocuments.scope, "evergreen")),
        // Approved, active, in-date only.
        eq(kbDocuments.active, true),
        eq(kbDocuments.approvalStatus, "approved"),
        or(isNull(kbDocuments.effectiveDate), lte(kbDocuments.effectiveDate, now)),
        or(isNull(kbDocuments.expiryDate), gte(kbDocuments.expiryDate, now)),
        gt(similarity, minScore),
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as ChunkMetadata;
    return {
      id: r.id,
      content: r.content,
      score: Number(r.score),
      documentTitle: meta.documentTitle,
      source: meta.source,
      scope: r.scope,
    } satisfies RetrievedChunk;
  });
}

/** True when retrieval produced at least one relevant chunk. */
export function hasRelevant(chunks: RetrievedChunk[]): boolean {
  return chunks.length > 0;
}
