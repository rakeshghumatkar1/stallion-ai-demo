/**
 * The active event — the single source of event scope (server-only).
 *
 * This deployment serves exactly ONE event, pinned by ACTIVE_EVENT_ID (e.g.
 * "INDIA-2027"). India and UAE are separate deployments of this same codebase.
 * A visitor can never switch events: there is no request-derived event id
 * anywhere. Every content/conversation query in the chat path scopes to this
 * event's id (plus evergreen), so another event's data is never even queried.
 *
 * See CLAUDE.md → "Event isolation".
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, type Event } from "@/lib/db/schema";

/** The pinned event slug from server config. Throws if unset. */
export function getActiveEventSlug(): string {
  const slug = process.env.ACTIVE_EVENT_ID;
  if (!slug) {
    throw new Error(
      "ACTIVE_EVENT_ID is not set. This deployment must be pinned to one event (e.g. INDIA-2027).",
    );
  }
  return slug;
}

/**
 * Load the active event row. Not cached, so admin edits to the event config are
 * reflected immediately; it's a single indexed lookup per request.
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
      `No active event found for ACTIVE_EVENT_ID=${slug}. Seed the event or check the slug.`,
    );
  }
  return row;
}
