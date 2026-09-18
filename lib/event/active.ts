/**
 * The active event — the single source of event scope (server-only).
 *
 * This production demo is intentionally pinned to ONE UAE/Dubai knowledge base.
 * The pin is application-owned, not request-derived and not controlled by the
 * visitor or by a stale Vercel environment variable. India data may remain in
 * storage for future projects, but this deployment cannot select it.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, type Event } from "@/lib/db/schema";

export const PINNED_EVENT_SLUG = "UAE-GMM-2026-TEST" as const;

export function getActiveEventSlug(): string {
  return PINNED_EVENT_SLUG;
}

/**
 * Load the pinned UAE event row. Not cached, so approved content/config updates
 * loaded at deploy time are reflected immediately.
 */
export async function getActiveEvent(): Promise<Event> {
  const slug = getActiveEventSlug();
  const [row] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.active, true)))
    .limit(1);
  if (!row) {
    throw new Error(
      `No active event found for pinned production event ${slug}. Load the UAE content package.`,
    );
  }
  return row;
}
