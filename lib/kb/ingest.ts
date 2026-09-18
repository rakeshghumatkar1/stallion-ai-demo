/**
 * Knowledge-base ingestion (server-only): chunk + embed on save.
 *
 * Used by the admin Knowledge editor and the seed script. Re-embeds a document's
 * chunks whenever its body changes. New documents are saved as `draft` and only
 * reach the model once an admin marks them `approved` (see lib/kb/retrieve.ts).
 * Evergreen docs carry a null eventId and scope='evergreen'; event docs must
 * carry an eventId and scope='event'.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { kbChunks, kbDocuments, type ChunkMetadata } from "@/lib/db/schema";
import { embedMany } from "@/lib/kb/embed";

export interface ChunkOptions {
  /** Target chunk size in characters. */
  size?: number;
  /** Overlap between consecutive chunks in characters. */
  overlap?: number;
}

/**
 * Split text into overlapping chunks, preferring paragraph boundaries. Pure and
 * deterministic so it can be unit-tested without a DB or network.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const size = opts.size ?? 1000;
  const overlap = opts.overlap ?? 150;
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    // Start next chunk with a tail overlap of the previous one.
    current = overlap > 0 && trimmed.length > overlap ? trimmed.slice(-overlap) : "";
  };

  for (const para of paragraphs) {
    if (para.length > size) {
      // Hard-split an oversized paragraph.
      if (current.trim()) flush();
      for (let i = 0; i < para.length; i += size - overlap) {
        chunks.push(para.slice(i, i + size).trim());
      }
      current = "";
      continue;
    }
    if ((current + "\n\n" + para).length > size) {
      flush();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.filter(Boolean);
}

export interface IngestInput {
  /** If provided, update this existing document; otherwise create a new one. */
  id?: string;
  eventId: string | null;
  scope: "evergreen" | "event";
  title: string;
  body: string;
  source?: string | null;
  /** Defaults to 'draft' for new docs — content is not live until approved. */
  approvalStatus?: "draft" | "approved";
  effectiveDate?: Date | null;
  expiryDate?: Date | null;
  lastVerified?: Date | null;
  active?: boolean;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
}

/**
 * Upsert a KB document and (re)build its chunks + embeddings in a transaction.
 */
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  if (input.scope === "event" && !input.eventId) {
    throw new Error("An event-scoped document requires an eventId.");
  }
  const eventId = input.scope === "evergreen" ? null : input.eventId;

  const pieces = chunkText(input.body);
  const vectors = pieces.length ? await embedMany(pieces) : [];

  return db.transaction(async (tx) => {
    let documentId = input.id;

    const docValues = {
      eventId,
      scope: input.scope,
      title: input.title,
      body: input.body,
      source: input.source ?? null,
      effectiveDate: input.effectiveDate ?? null,
      expiryDate: input.expiryDate ?? null,
      lastVerified: input.lastVerified ?? null,
      active: input.active ?? true,
      updatedAt: new Date(),
    };

    if (documentId) {
      await tx
        .update(kbDocuments)
        .set({
          ...docValues,
          // Only overwrite approval status when explicitly provided; editing a
          // doc otherwise keeps its current approval state.
          ...(input.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
        })
        .where(eq(kbDocuments.id, documentId));
      await tx.delete(kbChunks).where(eq(kbChunks.documentId, documentId));
    } else {
      const [doc] = await tx
        .insert(kbDocuments)
        .values({ ...docValues, approvalStatus: input.approvalStatus ?? "draft" })
        .returning({ id: kbDocuments.id });
      documentId = doc!.id;
    }

    if (pieces.length) {
      await tx.insert(kbChunks).values(
        pieces.map((content, index) => ({
          documentId: documentId!,
          eventId,
          scope: input.scope,
          content,
          embedding: vectors[index]!,
          metadata: {
            documentTitle: input.title,
            source: input.source ?? undefined,
            chunkIndex: index,
          } satisfies ChunkMetadata,
        })),
      );
    }

    return { documentId: documentId!, chunkCount: pieces.length };
  });
}
