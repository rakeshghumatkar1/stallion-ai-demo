/**
 * Tool definitions (server-only). Every tool:
 *  - validates its input with Zod,
 *  - is scoped to the single active event via a per-request closure (the model
 *    can NEVER pass an event id),
 *  - reads ONLY public, approved content (events public fields, active
 *    categories, approved KB, active forms) — never jury/admin/secret tables,
 *  - and takes no consequential external action in this phase (it only writes a
 *    lead / handoff / unanswered row and sends the handoff notification).
 *
 * get_event_facts is the ONLY source of hard facts and reads typed columns from
 * the already-resolved active event — never model free text.
 */
import "server-only";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  categories,
  conversations,
  forms,
  handoffs,
  leads,
  unansweredQuestions,
} from "@/lib/db/schema";
import type { Event, EventAnnouncement } from "@/lib/db/schema";
import { embedMany } from "@/lib/kb/embed";
import { notifyHandoff } from "@/lib/handoff/notify";
import { FACT_FIELDS, VISITOR_TYPES } from "@/lib/types";
import type { FactField, ResolvedFact, ToolContext } from "@/lib/types";

// ---- Pure fact resolution (testable, no DB/network) -------------------------

/** The disclaimer that MUST accompany any category suggestion. */
export const SUGGESTION_DISCLAIMER =
  "These may be relevant based on what you described — the team makes the final call on categories and eligibility.";

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  // Deterministic, human-friendly UTC date, e.g. "14 March 2027".
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatFees(fees: Event["fees"]): string | null {
  if (!fees || Object.keys(fees).length === 0) return null;
  return Object.entries(fees)
    .map(([key, v]) => {
      const amount = typeof v.amount === "number" ? v.amount.toLocaleString("en-US") : v.amount;
      const note = v.note ? ` (${v.note})` : "";
      return `${key}: ${v.currency} ${amount}${note}`;
    })
    .join("; ");
}

function formatTaxes(taxes: Event["taxes"]): string | null {
  if (!taxes || Object.keys(taxes).length === 0) return null;
  return Object.entries(taxes)
    .map(([key, v]) => {
      const label = v.label ?? key;
      if (typeof v.rate === "number") {
        const pct = v.rate <= 1 ? v.rate * 100 : v.rate; // accept 0.18 or 18
        return `${label}: ${pct}%${v.note ? ` (${v.note})` : ""}`;
      }
      if (typeof v.amount === "number") {
        return `${label}: ${v.currency ?? ""} ${v.amount.toLocaleString("en-US")}`.trim();
      }
      return `${label}${v.note ? `: ${v.note}` : ""}`;
    })
    .join("; ");
}

function formatContact(contact: Event["contact"]): string | null {
  if (!contact) return null;
  const parts: string[] = [];
  if (contact.team) parts.push(`team: ${contact.team}`);
  if (contact.email) parts.push(`email: ${contact.email}`);
  if (contact.phone) parts.push(`phone: ${contact.phone}`);
  if (contact.whatsapp) parts.push(`whatsapp: ${contact.whatsapp}`);
  if (contact.website) parts.push(`website: ${contact.website}`);
  return parts.length ? parts.join(", ") : null;
}

/**
 * Resolve requested fact fields from the (already event-scoped) event row.
 * Unset columns come back as { confirmed: false, value: null } so the caller/
 * model uses the not-confirmed pattern instead of guessing.
 */
function formatSponsors(sponsors: Event["sponsors"]): string | null {
  if (!sponsors || sponsors.length === 0) return null;
  return sponsors.map((s) => (s.tier ? `${s.name} (${s.tier})` : s.name)).join("; ");
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Announcements currently in effect (File 01 §1B "temporary announcements,
 * extensions or special conditions"). Expired or not-yet-effective items are
 * never surfaced, so an old extension cannot be presented as current.
 */
export function activeAnnouncements(
  announcements: Event["announcements"],
  now: Date = new Date(),
): EventAnnouncement[] {
  if (!announcements) return [];
  return announcements.filter((a) => {
    const from = parseIso(a.effectiveDate);
    const to = parseIso(a.expiryDate);
    if (from && from > now) return false;
    if (to && to < now) return false;
    return Boolean(a.text && a.text.trim());
  });
}

function formatAnnouncements(announcements: Event["announcements"], now: Date): string | null {
  // Never configured → not confirmed. Configured but none in effect → a
  // confirmed "none currently" (that absence is itself approved information).
  if (!announcements) return null;
  const active = activeAnnouncements(announcements, now);
  if (active.length === 0) {
    return "No announcements, extensions, or special conditions are currently in effect.";
  }
  return active
    .map((a) => {
      const until = parseIso(a.expiryDate);
      return until ? `${a.text.trim()} (valid until ${formatDate(until)})` : a.text.trim();
    })
    .join(" | ");
}

export function resolveFacts(event: Event, fields: FactField[], now: Date = new Date()): ResolvedFact[] {
  const wanted = fields.length ? fields : FACT_FIELDS;
  return wanted.map((field): ResolvedFact => {
    let value: string | null = null;
    switch (field) {
      case "event_date":
        value = formatDate(event.eventDate);
        break;
      case "venue":
        value = event.venue ?? null;
        break;
      case "eligibility_period":
        value = event.eligibilityPeriod ?? null;
        break;
      case "nomination_open":
        value = formatDate(event.nominationOpen);
        break;
      case "nomination_deadline":
        value = formatDate(event.nominationDeadline);
        break;
      case "fees":
        value = formatFees(event.fees);
        break;
      case "taxes":
        value = formatTaxes(event.taxes);
        break;
      case "contact":
        value = formatContact(event.contact);
        break;
      case "sponsors":
        value = formatSponsors(event.sponsors);
        break;
      case "announcements":
        value = formatAnnouncements(event.announcements, now);
        break;
    }
    const confirmed = value !== null && value !== "";
    return { field, confirmed, value: confirmed ? value : null };
  });
}

/** Cosine similarity for two equal-length vectors. */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ---- Zod input schemas ------------------------------------------------------

const getEventFactsInput = z.object({
  fields: z
    .array(z.enum(FACT_FIELDS as [FactField, ...FactField[]]))
    .default([])
    .describe("Which hard-fact fields to fetch. Empty = all."),
});

const suggestCategoriesInput = z.object({
  description: z
    .string()
    .min(1)
    .max(2000)
    .describe("What the visitor described about their work / campaign / entry."),
});

const getFormInput = z.object({
  category: z.string().max(200).optional().describe("Optional category name for a category-specific form."),
});

const captureLeadInput = z.object({
  name: z.string().max(200).optional(),
  org: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional().describe("Mobile number — collect ONLY if the visitor asked for a callback."),
  callback_requested: z.boolean().optional().describe("True only if the visitor asked to be called back."),
  visitor_type: z.enum(VISITOR_TYPES as [string, ...string[]]).optional(),
  approx_entries: z.number().int().min(0).max(100000).optional(),
  categories_discussed: z.array(z.string().max(200)).max(50).optional(),
  purpose: z.string().max(1000).optional(),
  notes: z.string().max(4000).optional(),
});

const escalateInput = z.object({
  reason: z.string().min(1).max(500).describe("Why this needs a human (large/commercial/unusual/unconfirmed)."),
  summary: z.string().min(1).max(4000).describe("A clear summary of the enquiry for the team."),
});

const logUnansweredInput = z.object({
  question: z.string().min(1).max(2000).describe("The visitor question the approved KB could not answer."),
});

// ---- Tool factory -----------------------------------------------------------

/**
 * Build the event-scoped tool set for a single request. The eventId is closed
 * over here; no tool accepts it as an argument.
 */
export function makeTools(ctx: ToolContext): Record<string, Tool> {
  return {
    get_event_facts: tool({
      description:
        "Get approved structured facts for THIS event (dates, venue, deadline, nomination-open, eligibility period, fees, taxes, contacts, sponsors, and current announcements such as extensions or special conditions — only while in date). The ONLY source of hard facts. Unset fields return confirmed:false — use the fallback wording, never guess.",
      parameters: getEventFactsInput,
      execute: async ({ fields }) => {
        const facts = resolveFacts(ctx.event, fields as FactField[]);
        return {
          event: ctx.event.name,
          facts,
          note: "Use only these values. For any field with confirmed:false, tell the visitor it isn't confirmed yet, offer the team, and call log_unanswered.",
        };
      },
    }),

    list_categories: tool({
      description: "List the active award categories for THIS event.",
      parameters: z.object({}),
      execute: async () => {
        const rows = await db
          .select({
            name: categories.name,
            officialName: categories.officialName,
            description: categories.description,
            eligibilityRules: categories.eligibilityRules,
            clientApprovalRequired: categories.clientApprovalRequired,
          })
          .from(categories)
          .where(and(eq(categories.eventId, ctx.eventId), eq(categories.active, true)));
        return { eventId: ctx.eventId, categories: rows };
      },
    }),

    suggest_categories: tool({
      description:
        "Suggest award categories that MAY fit what the visitor described (semantic match). Always framed as options, never a verdict. Only assert eligibility when a category's deterministic eligibility rule confirms it.",
      parameters: suggestCategoriesInput,
      execute: async ({ description }) => {
        const rows = await db
          .select({
            name: categories.name,
            officialName: categories.officialName,
            description: categories.description,
            eligibilityRules: categories.eligibilityRules,
            clientApprovalRequired: categories.clientApprovalRequired,
          })
          .from(categories)
          .where(and(eq(categories.eventId, ctx.eventId), eq(categories.active, true)));

        if (rows.length === 0) {
          return { suggestions: [], disclaimer: SUGGESTION_DISCLAIMER };
        }

        // Semantic ranking over category text. Falls back to unranked if
        // embeddings are unavailable.
        let ranked = rows.map((r) => ({ ...r, score: 0 }));
        try {
          const texts = rows.map((r) => `${r.name}. ${r.description ?? ""}`);
          const [queryVec, ...catVecs] = await embedMany([description, ...texts]);
          ranked = rows
            .map((r, i) => ({ ...r, score: cosine(queryVec!, catVecs[i]!) }))
            .sort((a, b) => b.score - a.score);
        } catch {
          // keep unranked fallback
        }

        return { suggestions: ranked.slice(0, 3), disclaimer: SUGGESTION_DISCLAIMER };
      },
    }),

    get_form: tool({
      description: "Get the approved, active nomination form URL for THIS event (optionally for a category).",
      parameters: getFormInput,
      execute: async ({ category }) => {
        if (category) {
          const [byCat] = await db
            .select({ name: forms.name, url: forms.url })
            .from(forms)
            .innerJoin(categories, eq(forms.categoryId, categories.id))
            .where(
              and(
                eq(forms.eventId, ctx.eventId),
                eq(forms.active, true),
                eq(categories.name, category),
              ),
            )
            .limit(1);
          if (byCat) return { form: byCat };
        }
        const [general] = await db
          .select({ name: forms.name, url: forms.url })
          .from(forms)
          .where(and(eq(forms.eventId, ctx.eventId), eq(forms.active, true), isNull(forms.categoryId)))
          .limit(1);
        if (general) return { form: general };

        const [any] = await db
          .select({ name: forms.name, url: forms.url })
          .from(forms)
          .where(and(eq(forms.eventId, ctx.eventId), eq(forms.active, true)))
          .limit(1);
        return { form: any ?? null };
      },
    }),

    capture_lead: tool({
      description:
        "Save the visitor's details as a lead. Help first, ask later. Call ONLY after the visitor has clearly agreed to event-team follow-up or explicitly asked to be contacted, and only after enough useful contact information has been collected. Save once rather than after every individual detail. Use only details the visitor volunteered: name, company (org), email, mobile (phone) only if a callback was requested, visitor type, categories of interest, approximate entries, and a short summary (purpose).",
      parameters: captureLeadInput,
      execute: async (input) => {
        const [row] = await db
          .insert(leads)
          .values({
            conversationId: ctx.conversationId,
            eventId: ctx.eventId,
            name: input.name ?? null,
            org: input.org ?? null,
            role: input.role ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            callbackRequested: input.callback_requested ?? false,
            visitorType: input.visitor_type ?? null,
            approxEntries: input.approx_entries ?? null,
            categoriesDiscussed: input.categories_discussed ?? null,
            purpose: input.purpose ?? null,
            notes: input.notes ?? null,
          })
          .returning({ id: leads.id });
        return { ok: true, leadId: row!.id };
      },
    }),

    escalate_to_human: tool({
      description:
        "Hand off to the team. Use for large, commercial (sponsorship/partnership), unusual, or unconfirmable enquiries, complaints, or a direct request for a person — BUT only after the visitor has explicitly asked for human contact or clearly agreed when you offered a handoff. Do not notify the team silently. Writes a handoff and notifies the team.",
      parameters: escalateInput,
      execute: async ({ reason, summary }) => {
        const [row] = await db
          .insert(handoffs)
          .values({ conversationId: ctx.conversationId, eventId: ctx.eventId, reason, summary, status: "open" })
          .returning({ id: handoffs.id });

        await db
          .update(conversations)
          .set({ status: "handed_off", summary })
          .where(eq(conversations.id, ctx.conversationId));

        await notifyHandoff({
          handoffId: row!.id,
          event: ctx.event,
          reason,
          summary,
          conversationId: ctx.conversationId,
        });

        return {
          ok: true,
          handoffId: row!.id,
          message: "I've passed this to the team with a summary — they'll follow up with you.",
        };
      },
    }),

    log_unanswered: tool({
      description:
        "Record a visitor question the approved knowledge base could not answer. Call this whenever you couldn't confirm something and offered the team.",
      parameters: logUnansweredInput,
      execute: async ({ question }) => {
        await db.insert(unansweredQuestions).values({
          conversationId: ctx.conversationId,
          eventId: ctx.eventId,
          question,
        });
        return { ok: true };
      },
    }),
  };
}
