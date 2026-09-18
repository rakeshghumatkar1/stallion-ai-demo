/**
 * Single active event for the production demo.
 *
 * The chatbot is application-pinned to UAE-GMM-2026-TEST. A visitor cannot
 * switch it to India or another event. The database row exists only so
 * conversations/leads/handoffs can keep their existing foreign keys; factual
 * read paths come from the static UAE knowledge module.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, type Event } from "@/lib/db/schema";
import { UAE_EVENT } from "@/lib/demo/uae-knowledge";

export const PINNED_EVENT_SLUG = UAE_EVENT.slug;

export function getActiveEventSlug(): string {
  return PINNED_EVENT_SLUG;
}

export async function getActiveEvent(): Promise<Event> {
  const [existing] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, PINNED_EVENT_SLUG), eq(events.active, true)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(events)
    .values({
      slug: UAE_EVENT.slug,
      name: UAE_EVENT.name,
      country: UAE_EVENT.country,
      year: UAE_EVENT.year,
      editionNumber: UAE_EVENT.editionNumber,
      eventDate: null,
      venue: null,
      eligibilityPeriod: null,
      nominationOpen: null,
      nominationDeadline: null,
      fees: null,
      taxes: null,
      contact: { ...UAE_EVENT.contact },
      sponsors: null,
      announcements: null,
      status: UAE_EVENT.status,
      active: true,
    })
    .onConflictDoUpdate({
      target: events.slug,
      set: { active: true, updatedAt: new Date() },
    })
    .returning();

  if (!created) throw new Error("Unable to initialise the pinned UAE demo event.");
  return created;
}
