"use server";

/**
 * Admin server actions. Every mutating action re-checks the session (pages are
 * gated by the layout, but actions are callable directly) and is scoped to the
 * pinned event — the admin can never touch another event's rows.
 * All form input is validated with Zod before it reaches the DB.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  clearSessionCookie,
  createSessionCookie,
  getAdminSession,
  verifyLogin,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { events, handoffs, kbDocuments } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/event/active";
import { ingestDocument } from "@/lib/kb/ingest";
import { SOURCE_TYPES, type SourceType } from "@/lib/types";

export type LoginState = { error?: string };

async function requireAdmin() {
  const session = getAdminSession(await cookies());
  if (!session) throw new Error("Unauthorized");
  return session;
}

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

// ---- Auth -------------------------------------------------------------------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });
  if (!parsed.success || !verifyLogin(parsed.data.email, parsed.data.password)) {
    return { error: "Invalid email or password." };
  }
  const c = createSessionCookie(parsed.data.email);
  (await cookies()).set(c.name, c.value, c.options);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const c = clearSessionCookie();
  (await cookies()).set(c.name, c.value, c.options);
  redirect("/admin");
}

// ---- Shared validators ------------------------------------------------------

/** "" → null; otherwise must parse as a date (datetime-local values are UTC). */
const optionalDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v.endsWith("Z") || v.includes("+") ? v : `${v}Z`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return d;
  });

/** "" → null; otherwise must be a JSON object. */
const optionalJsonObject = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    try {
      const parsed: unknown = JSON.parse(v);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a JSON object" });
      return z.NEVER;
    }
  });

/** "" → null; otherwise must be a JSON array whose items match `item`. */
function optionalJsonArrayOf<T extends z.ZodTypeAny>(item: T) {
  return z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(v);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be valid JSON" });
        return z.NEVER;
      }
      const result = z.array(item).safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Must be a JSON array: ${result.error.issues[0]?.message}` });
        return z.NEVER;
      }
      return result.data as z.infer<T>[];
    });
}

const isoDateOrNull = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || !Number.isNaN(new Date(v).getTime()), "Invalid ISO date");

const sponsorSchema = z.object({
  name: z.string().trim().min(1),
  tier: z.string().nullish(),
  url: z.string().nullish(),
});

const announcementSchema = z.object({
  text: z.string().trim().min(1),
  effectiveDate: isoDateOrNull,
  expiryDate: isoDateOrNull,
});

function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? `${i.path.join(".") || "form"}: ${i.message}` : "Invalid input";
}

// ---- Event config -----------------------------------------------------------

const eventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: z.coerce.number().int().min(2000).max(2100),
  editionNumber: z.union([z.literal(""), z.coerce.number().int().min(1).max(999)]),
  status: z.enum(["draft", "open", "closed"]),
  venue: z.string().trim().max(500),
  eligibilityPeriod: z.string().trim().max(500),
  eventDate: optionalDate,
  nominationOpen: optionalDate,
  nominationDeadline: optionalDate,
  fees: optionalJsonObject,
  taxes: optionalJsonObject,
  contact: optionalJsonObject,
  sponsors: optionalJsonArrayOf(sponsorSchema),
  announcements: optionalJsonArrayOf(announcementSchema),
});

export async function updateEventAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const event = await getActiveEvent();

  const parsed = eventSchema.safeParse({
    name: field(formData, "name"),
    year: field(formData, "year"),
    editionNumber: field(formData, "editionNumber"),
    status: field(formData, "status"),
    venue: field(formData, "venue"),
    eligibilityPeriod: field(formData, "eligibilityPeriod"),
    eventDate: field(formData, "eventDate"),
    nominationOpen: field(formData, "nominationOpen"),
    nominationDeadline: field(formData, "nominationDeadline"),
    fees: field(formData, "fees"),
    taxes: field(formData, "taxes"),
    contact: field(formData, "contact"),
    sponsors: field(formData, "sponsors"),
    announcements: field(formData, "announcements"),
  });
  if (!parsed.success) {
    redirect(`/admin/event?error=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  const d = parsed.data;

  // Only the pinned event is ever updated; slug and country stay fixed because
  // they are the deployment's identity.
  await db
    .update(events)
    .set({
      name: d.name,
      year: d.year,
      editionNumber: d.editionNumber === "" ? null : d.editionNumber,
      status: d.status,
      venue: d.venue || null,
      eligibilityPeriod: d.eligibilityPeriod || null,
      eventDate: d.eventDate,
      nominationOpen: d.nominationOpen,
      nominationDeadline: d.nominationDeadline,
      fees: d.fees as typeof events.$inferInsert.fees,
      taxes: d.taxes as typeof events.$inferInsert.taxes,
      contact: d.contact as typeof events.$inferInsert.contact,
      sponsors: d.sponsors,
      announcements: d.announcements,
      updatedAt: new Date(),
    })
    .where(eq(events.id, event.id));

  redirect("/admin/event?saved=1");
}

// ---- Knowledge base ---------------------------------------------------------

const kbSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]),
  title: z.string().trim().min(1).max(300),
  scope: z.enum(["evergreen", "event"]),
  body: z.string().trim().min(1).max(200_000),
  source: z.string().trim().max(500),
  approvalStatus: z.enum(["draft", "approved"]),
  active: z.enum(["on", ""]).optional(),
  sourceType: z.enum(SOURCE_TYPES as [SourceType, ...SourceType[]]),
  provisional: z.enum(["on", ""]).optional(),
  effectiveDate: optionalDate,
  expiryDate: optionalDate,
});

export async function saveKbDocumentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const event = await getActiveEvent();

  const parsed = kbSchema.safeParse({
    id: field(formData, "id"),
    title: field(formData, "title"),
    scope: field(formData, "scope"),
    body: field(formData, "body"),
    source: field(formData, "source"),
    approvalStatus: field(formData, "approvalStatus"),
    active: field(formData, "active"),
    sourceType: field(formData, "sourceType"),
    provisional: field(formData, "provisional"),
    effectiveDate: field(formData, "effectiveDate"),
    expiryDate: field(formData, "expiryDate"),
  });
  if (!parsed.success) {
    const back = field(formData, "id") ? `id=${field(formData, "id")}&` : "new=1&";
    redirect(`/admin/knowledge?${back}error=${encodeURIComponent(firstIssue(parsed.error))}`);
  }
  const d = parsed.data;
  const id = d.id || undefined;

  // An existing doc must be this event's or evergreen — never another event's.
  if (id) {
    const [owned] = await db
      .select({ id: kbDocuments.id })
      .from(kbDocuments)
      .where(and(eq(kbDocuments.id, id), or(eq(kbDocuments.eventId, event.id), eq(kbDocuments.scope, "evergreen"))))
      .limit(1);
    if (!owned) redirect("/admin/knowledge?error=Document%20not%20found");
  }

  let documentId: string;
  try {
    const result = await ingestDocument({
      id,
      eventId: d.scope === "event" ? event.id : null,
      scope: d.scope,
      title: d.title,
      body: d.body,
      source: d.source || null,
      approvalStatus: d.approvalStatus,
      effectiveDate: d.effectiveDate,
      expiryDate: d.expiryDate,
      lastVerified: new Date(),
      active: d.active === "on",
      sourceType: d.sourceType,
      provisional: d.provisional === "on",
    });
    documentId = result.documentId;
  } catch (err) {
    console.error("[admin] KB ingest failed", err);
    const back = id ? `id=${id}&` : "new=1&";
    redirect(`/admin/knowledge?${back}error=${encodeURIComponent("Save failed (embeddings unavailable?). Check OPENAI_API_KEY.")}`);
  }

  // Bump the version on edits so reviewers can see content changed.
  if (id) {
    await db
      .update(kbDocuments)
      .set({ version: sql`${kbDocuments.version} + 1` })
      .where(eq(kbDocuments.id, id));
  }

  redirect(`/admin/knowledge?id=${documentId}&saved=1`);
}

const kbApprovalSchema = z.object({
  id: z.string().uuid(),
  approvalStatus: z.enum(["draft", "approved"]),
});

/** Quick approve / unapprove without re-embedding. */
export async function setKbApprovalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const event = await getActiveEvent();
  const parsed = kbApprovalSchema.safeParse({
    id: field(formData, "id"),
    approvalStatus: field(formData, "approvalStatus"),
  });
  if (!parsed.success) redirect("/admin/knowledge?error=Invalid%20request");

  await db
    .update(kbDocuments)
    .set({ approvalStatus: parsed.data.approvalStatus, updatedAt: new Date() })
    .where(
      and(
        eq(kbDocuments.id, parsed.data.id),
        or(eq(kbDocuments.eventId, event.id), eq(kbDocuments.scope, "evergreen")),
      ),
    );
  redirect("/admin/knowledge");
}

// ---- Handoffs ---------------------------------------------------------------

const handoffStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "acknowledged", "closed"]),
  assignedTo: z.string().trim().max(200),
});

export async function updateHandoffAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const event = await getActiveEvent();
  const parsed = handoffStatusSchema.safeParse({
    id: field(formData, "id"),
    status: field(formData, "status"),
    assignedTo: field(formData, "assignedTo"),
  });
  if (!parsed.success) redirect("/admin/handoffs?error=Invalid%20request");

  await db
    .update(handoffs)
    .set({ status: parsed.data.status, assignedTo: parsed.data.assignedTo || null })
    .where(and(eq(handoffs.id, parsed.data.id), eq(handoffs.eventId, event.id)));
  redirect("/admin/handoffs");
}
