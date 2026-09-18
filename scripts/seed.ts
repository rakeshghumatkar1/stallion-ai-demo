/**
 * Seed a sample INDIA-2027 event so the assistant can answer real questions on
 * first run. Idempotent: re-running replaces the sample categories, form, and
 * KB documents for this event (and the evergreen docs it owns) and upserts the
 * event row.
 *
 * ALL VALUES BELOW ARE SAMPLE DATA. Edit them in the admin before going live.
 * The team contact is a team mailbox, never a named person.
 *
 * Run with: npm run seed   (needs DATABASE_URL + OPENAI_API_KEY for embeddings)
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { and, eq, inArray, or } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";
import { categories, events, forms, kbDocuments } from "@/lib/db/schema";
import { ingestDocument } from "@/lib/kb/ingest";

const SLUG = process.env.ACTIVE_EVENT_ID ?? "INDIA-2027";
const CONTACT_EMAIL = process.env.SEED_CONTACT_EMAIL ?? process.env.HANDOFF_EMAIL ?? "awards@example.com";

// One set of constants feeds BOTH the typed columns and the KB copy so the two
// never disagree (and the grounding check sees the same values everywhere).
const EVENT = {
  name: "Digital Stallion Awards India 2027",
  country: "IN",
  year: 2027,
  editionNumber: 3,
  eventDate: new Date("2027-03-19T13:00:00Z"),
  venue: "Mumbai, India (venue details to be announced)",
  eligibilityPeriod: "Work live between 1 January 2026 and 31 December 2026",
  nominationOpen: new Date("2026-10-01T00:00:00Z"),
  nominationDeadline: new Date("2027-01-31T18:29:00Z"),
  fees: {
    standard: { amount: 15000, currency: "INR", note: "per entry, standard" },
    early_bird: { amount: 12000, currency: "INR", note: "per entry, before the early-bird date announced by the team" },
  },
  taxes: {
    gst: { label: "GST", rate: 18, note: "applies on entry fees" },
  },
  contact: {
    team: "Digital Stallion Awards Team",
    email: CONTACT_EMAIL,
    website: "https://example.com/india-2027",
  },
  status: "open",
};

const CATEGORIES = [
  {
    name: "Best Digital Campaign",
    officialName: "Best Digital Campaign of the Year",
    description:
      "An integrated digital campaign that delivered measurable results for a brand across two or more digital channels.",
    eligibilityRules: {
      summary: "Campaign must have been live during the eligibility period.",
      requirements: ["Campaign objectives and measurable results", "Client approval if entered by an agency"],
    },
    clientApprovalRequired: true,
  },
  {
    name: "Best Social Media Campaign",
    description: "A campaign built primarily on social platforms, judged on creativity, engagement, and outcomes.",
    eligibilityRules: { summary: "Campaign must have been live during the eligibility period." },
    clientApprovalRequired: true,
  },
  {
    name: "Best Use of Influencer Marketing",
    description: "Creator or influencer-led work that drove brand outcomes with transparent partnership practices.",
    eligibilityRules: { summary: "Campaign must have been live during the eligibility period." },
    clientApprovalRequired: true,
  },
  {
    name: "Best Performance Marketing Campaign",
    description: "Paid media, search, or growth work judged on efficiency and business impact.",
    eligibilityRules: { summary: "Campaign must have been live during the eligibility period." },
    clientApprovalRequired: true,
  },
  {
    name: "Digital Agency of the Year",
    description: "An agency recognised for its body of work, growth, culture, and client outcomes over the year.",
    eligibilityRules: {
      summary: "Open to agencies with an operating presence in India.",
      requirements: ["Portfolio of at least three client projects from the eligibility period"],
    },
    clientApprovalRequired: false,
  },
  {
    name: "Emerging Brand of the Year",
    description: "A young brand that made an outsized digital impact.",
    eligibilityRules: {
      summary: "Brands founded within the last five years.",
      // A deterministic rule the app can assert on; everything else is a team call.
      deterministic: { max_company_age_years: 5 },
    },
    clientApprovalRequired: false,
  },
  {
    name: "Digital Marketer of the Year",
    description: "An individual recognised for leadership and results in digital marketing.",
    eligibilityRules: {
      summary: "Individual award — nominations may be submitted by the person or their organisation.",
    },
    clientApprovalRequired: false,
  },
];

const FORM = {
  name: "General nomination form",
  url: "https://example.com/india-2027/nominate",
};

// Titles are used to find and replace our own seed docs on re-run.
const EVERGREEN_DOCS = [
  {
    title: "About the Digital Stallion Awards",
    body: `The Digital Stallion Awards recognise excellence in digital marketing, media, and creativity. Editions are held in India and the UAE; each edition has its own categories, dates, fees, and nomination form.

Who can enter: brands, agencies, and individuals. Brands may nominate their own campaigns, products, initiatives, or people. Agencies may nominate client work (client approval may be required before final submission), the agency itself, or their people. Individuals may be nominated for individual awards.

Campaign awards, organisation awards, and individual awards are distinct. A campaign award recognises a specific piece of work; an organisation award recognises a company or agency over the year; an individual award recognises a person.

Sponsorship and partnership enquiries are handled directly by the Digital Stallion team rather than through the nomination process.`,
  },
  {
    title: "How nominations work",
    body: `Nominations are submitted through the official nomination form for the edition. Each entry is submitted into one category; the same work may be entered into more than one category as separate entries.

A typical nomination includes: the entrant's details, the category, a summary of the work, objectives, execution, and results, plus any supporting links or files requested by the form. Entry fees apply per entry and taxes may apply depending on the edition.

Entries are reviewed for eligibility by the awards team, then evaluated by an independent jury. Jury members, scoring, and deliberations are confidential and are not shared with entrants. The awards team makes the final call on eligibility and category placement.

The assistant can suggest categories that may fit, point you to the correct form, and connect you with the team for anything it cannot confirm.`,
  },
];

const EVENT_DOCS = [
  {
    title: `${EVENT.name} — edition overview`,
    body: `${EVENT.name} is the ${EVENT.editionNumber}rd edition of the Digital Stallion Awards in India.

Key facts for this edition: the ceremony is scheduled for 19 March 2027 in ${EVENT.venue}. Nominations open on 1 October 2026 and the nomination deadline is 31 January 2027. Work is eligible if it was live between 1 January 2026 and 31 December 2026.

Entry fees: standard INR 15,000 per entry; an early-bird rate of INR 12,000 per entry applies before the early-bird date announced by the team. GST of 18% applies on entry fees.

Nominations are submitted through the general nomination form. Agencies entering client work should have client approval before final submission. For sponsorship, partnership, bulk entries, or anything not covered here, the Digital Stallion Awards Team can help directly.`,
  },
];

/** Seed (or re-seed) the sample event. Exported so harnesses can call it in-process. */
export async function seed() {
  console.log(`[seed] seeding sample event ${SLUG}…`);

  // 1. Upsert the event row (typed fact columns).
  const [event] = await db
    .insert(events)
    .values({ slug: SLUG, ...EVENT, active: true })
    .onConflictDoUpdate({ target: events.slug, set: { ...EVENT, active: true, updatedAt: new Date() } })
    .returning();
  if (!event) throw new Error("event upsert returned nothing");

  // 2. Replace categories and the form for this event.
  await db.delete(forms).where(eq(forms.eventId, event.id));
  await db.delete(categories).where(eq(categories.eventId, event.id));
  await db.insert(categories).values(CATEGORIES.map((c) => ({ ...c, eventId: event.id, active: true })));
  await db.insert(forms).values({ eventId: event.id, categoryId: null, ...FORM, active: true });

  // 3. Replace our seed KB docs (chunks cascade), then ingest as approved so the
  //    assistant can use them immediately.
  const seedTitles = [...EVERGREEN_DOCS, ...EVENT_DOCS].map((d) => d.title);
  await db
    .delete(kbDocuments)
    .where(
      and(
        inArray(kbDocuments.title, seedTitles),
        or(eq(kbDocuments.eventId, event.id), eq(kbDocuments.scope, "evergreen")),
      ),
    );

  for (const doc of EVERGREEN_DOCS) {
    const r = await ingestDocument({
      eventId: null,
      scope: "evergreen",
      title: doc.title,
      body: doc.body,
      source: "seed",
      approvalStatus: "approved",
      lastVerified: new Date(),
    });
    console.log(`[seed] evergreen "${doc.title}" → ${r.chunkCount} chunks`);
  }
  for (const doc of EVENT_DOCS) {
    const r = await ingestDocument({
      eventId: event.id,
      scope: "event",
      title: doc.title,
      body: doc.body,
      source: "seed",
      approvalStatus: "approved",
      lastVerified: new Date(),
    });
    console.log(`[seed] event "${doc.title}" → ${r.chunkCount} chunks`);
  }

  console.log(`[seed] done. ACTIVE_EVENT_ID=${SLUG} (event id ${event.id}).`);
}

// Auto-run only when executed directly (`npm run seed`), not when imported.
const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isDirectRun) {
  seed()
    .catch((err) => {
      console.error("[seed] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
