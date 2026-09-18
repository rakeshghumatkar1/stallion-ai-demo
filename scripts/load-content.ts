/**
 * Load the content package (content/) into the database.
 *
 *   content/evergreen/*.md                     → evergreen kb_documents
 *   content/editions/<EVENT_ID>/config.json    → events, categories, forms, jury
 *   content/editions/<EVENT_ID>/*.md           → event-scoped kb_documents
 *
 * Front matter on each .md carries source_type / provisional / approval status
 * (File 01 §2–3). Documents are matched by (scope, event, title) so re-running
 * updates in place and re-embeds. Categories and forms are matched by name;
 * ones missing from config.json are deactivated (retired), never deleted.
 *
 * Run with: npm run content:load [-- --event UAE-2026] [-- --evergreen-only]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { closeDb, db } from "@/lib/db";
import { categories, events, forms, jury, kbDocuments } from "@/lib/db/schema";
import { ingestDocument } from "@/lib/kb/ingest";
import { SOURCE_TYPES, type SourceType } from "@/lib/types";

const CONTENT_ROOT = path.join(process.cwd(), "content");

// ---- Front matter (tiny, dependency-free: `key: value` lines only) ----------

export function parseFrontMatter(raw: string): { data: Record<string, string>; body: string } {
  const text = raw.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { data: {}, body: text };
  const block = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\s*\n/, "");
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2]!.replace(/\s+#.*$/, "").trim(); // trailing "  # comment"
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[m[1]!] = value;
  }
  return { data, body };
}

const optionalIsoDate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid date "${v}"` });
      return z.NEVER;
    }
    return d;
  });

const boolString = z
  .string()
  .optional()
  .transform((v) => (v ? ["true", "yes", "1"].includes(v.toLowerCase()) : undefined));

const docMetaSchema = z.object({
  title: z.string().optional(),
  source_type: z.enum(SOURCE_TYPES as [SourceType, ...SourceType[]]).optional(),
  provisional: boolString,
  approval_status: z.enum(["draft", "approved"]).optional(),
  effective_date: optionalIsoDate,
  expiry_date: optionalIsoDate,
  source: z.string().optional(),
  active: boolString,
});

function titleFrom(meta: { title?: string }, body: string, file: string): string {
  if (meta.title) return meta.title;
  const h1 = body.match(/^#\s+(.+)$/m);
  return h1 ? h1[1]!.trim() : path.basename(file, ".md");
}

// ---- Edition config (File 01 §1B) ------------------------------------------

const isoOrNull = z
  .string()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `invalid date "${v}"` });
      return z.NEVER;
    }
    return d;
  });

const jsonObjectOrNull = z.record(z.string(), z.unknown()).nullable().optional();

const configSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    country: z.string().min(2).max(2),
    year: z.number().int(),
    edition_number: z.number().int().nullable().optional(),
    status: z.enum(["draft", "open", "closed"]).default("draft"),
    eligibility_period: z.string().nullable().optional(),
    nomination_open: isoOrNull,
    nomination_deadline: isoOrNull,
    event_date: isoOrNull,
    venue: z.string().nullable().optional(),
    fees: jsonObjectOrNull,
    taxes: jsonObjectOrNull,
    categories: z
      .array(
        z.object({
          name: z.string().min(1),
          official_name: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          eligibility_rules: z.record(z.string(), z.unknown()).nullable().optional(),
          client_approval_required: z.boolean().default(false),
          active: z.boolean().default(true),
        }),
      )
      .default([]),
    forms: z
      .array(z.object({ name: z.string().min(1), url: z.string().url(), category: z.string().nullable().optional() }))
      .default([]),
    jury: z
      .array(z.object({ name: z.string().min(1), details: z.string().nullable().optional(), confidential: z.boolean().default(true) }))
      .default([]),
    contact: jsonObjectOrNull,
    sponsors: z.array(z.object({ name: z.string().min(1), tier: z.string().nullable().optional(), url: z.string().nullable().optional() })).nullable().optional(),
    announcements: z
      .array(z.object({ text: z.string().min(1), effective_date: z.string().nullable().optional(), expiry_date: z.string().nullable().optional() }))
      .nullable()
      .optional(),
  })
  .passthrough(); // allows "_readme"

/** Drop placeholder keys (starting with "_") from fee/tax maps and warn. */
function stripPlaceholders(obj: Record<string, unknown> | null | undefined, label: string) {
  if (!obj) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("_")) console.warn(`[content] ${label}: ignoring placeholder key "${k}"`);
    else out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// ---- Loading ----------------------------------------------------------------

async function upsertDocument(input: {
  eventId: string | null;
  scope: "evergreen" | "event";
  title: string;
  body: string;
  meta: z.infer<typeof docMetaSchema>;
  file: string;
}) {
  const scopeCond =
    input.scope === "evergreen"
      ? and(eq(kbDocuments.scope, "evergreen"), isNull(kbDocuments.eventId))
      : and(eq(kbDocuments.scope, "event"), eq(kbDocuments.eventId, input.eventId!));
  const [existing] = await db
    .select({ id: kbDocuments.id })
    .from(kbDocuments)
    .where(and(scopeCond, eq(kbDocuments.title, input.title)))
    .limit(1);

  const sourceType: SourceType = input.meta.source_type ?? (input.scope === "evergreen" ? "evergreen" : "edition_config");
  const r = await ingestDocument({
    id: existing?.id,
    eventId: input.eventId,
    scope: input.scope,
    title: input.title,
    body: input.body,
    source: input.meta.source ?? path.relative(process.cwd(), input.file),
    sourceType,
    provisional: input.meta.provisional ?? sourceType === "website",
    approvalStatus: input.meta.approval_status ?? "draft",
    effectiveDate: input.meta.effective_date,
    expiryDate: input.meta.expiry_date,
    lastVerified: new Date(),
    active: input.meta.active ?? true,
  });
  if (existing) {
    await db.update(kbDocuments).set({ version: sql`${kbDocuments.version} + 1` }).where(eq(kbDocuments.id, existing.id));
  }
  console.log(
    `[content] ${existing ? "updated" : "created"} ${input.scope} doc "${input.title}" (${sourceType}${
      input.meta.provisional || sourceType === "website" ? ", historical" : ""
    }, ${input.meta.approval_status ?? "draft"}) → ${r.chunkCount} chunks`,
  );
}

function markdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => path.join(dir, f))
    .sort();
}

export async function loadEvergreen(): Promise<number> {
  const files = markdownFiles(path.join(CONTENT_ROOT, "evergreen"));
  for (const file of files) {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, "utf8"));
    const meta = docMetaSchema.parse(data);
    await upsertDocument({ eventId: null, scope: "evergreen", title: titleFrom(meta, body, file), body, meta, file });
  }
  return files.length;
}

export async function loadEdition(slug: string): Promise<void> {
  const dir = path.join(CONTENT_ROOT, "editions", slug);
  const configPath = path.join(dir, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No ${path.relative(process.cwd(), configPath)}. Copy config.example.json to config.json and fill in organiser-approved values.`,
    );
  }
  const cfg = configSchema.parse(JSON.parse(fs.readFileSync(configPath, "utf8")));
  if (cfg.slug !== slug) throw new Error(`config.json slug "${cfg.slug}" does not match folder "${slug}"`);

  // 1. Event row (typed fact columns).
  const eventValues = {
    name: cfg.name,
    country: cfg.country,
    year: cfg.year,
    editionNumber: cfg.edition_number ?? null,
    status: cfg.status,
    eligibilityPeriod: cfg.eligibility_period ?? null,
    nominationOpen: cfg.nomination_open ?? null,
    nominationDeadline: cfg.nomination_deadline ?? null,
    eventDate: cfg.event_date ?? null,
    venue: cfg.venue ?? null,
    fees: stripPlaceholders(cfg.fees, "fees") as typeof events.$inferInsert.fees,
    taxes: stripPlaceholders(cfg.taxes, "taxes") as typeof events.$inferInsert.taxes,
    contact: (cfg.contact ?? null) as typeof events.$inferInsert.contact,
    sponsors: cfg.sponsors ?? null,
    announcements: cfg.announcements
      ? cfg.announcements.map((a) => ({ text: a.text, effectiveDate: a.effective_date ?? null, expiryDate: a.expiry_date ?? null }))
      : null,
    active: true,
    updatedAt: new Date(),
  };
  const [event] = await db
    .insert(events)
    .values({ slug, ...eventValues })
    .onConflictDoUpdate({ target: events.slug, set: eventValues })
    .returning({ id: events.id });
  if (!event) throw new Error("event upsert returned nothing");
  console.log(`[content] event ${slug} upserted (${event.id})`);

  // 2. Categories: upsert by name; deactivate ones no longer in config.
  const keepNames: string[] = [];
  for (const c of cfg.categories) {
    keepNames.push(c.name);
    const values = {
      officialName: c.official_name ?? null,
      description: c.description ?? null,
      eligibilityRules: (c.eligibility_rules ?? null) as typeof categories.$inferInsert.eligibilityRules,
      clientApprovalRequired: c.client_approval_required,
      active: c.active,
    };
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.eventId, event.id), eq(categories.name, c.name)))
      .limit(1);
    if (existing) await db.update(categories).set(values).where(eq(categories.id, existing.id));
    else await db.insert(categories).values({ eventId: event.id, name: c.name, ...values });
  }
  const allCats = await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.eventId, event.id));
  for (const c of allCats) {
    if (!keepNames.includes(c.name)) {
      await db.update(categories).set({ active: false }).where(eq(categories.id, c.id));
      console.log(`[content] category retired: "${c.name}"`);
    }
  }
  console.log(`[content] ${cfg.categories.length} categories`);

  // 3. Forms: upsert by name; deactivate ones no longer in config.
  const keepForms: string[] = [];
  for (const f of cfg.forms) {
    keepForms.push(f.name);
    const cat = f.category ? allCats.find((c) => c.name === f.category) : undefined;
    if (f.category && !cat) console.warn(`[content] form "${f.name}": category "${f.category}" not found; saved as general`);
    const values = { url: f.url, categoryId: cat?.id ?? null, active: true };
    const [existing] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.eventId, event.id), eq(forms.name, f.name)))
      .limit(1);
    if (existing) await db.update(forms).set(values).where(eq(forms.id, existing.id));
    else await db.insert(forms).values({ eventId: event.id, name: f.name, ...values });
  }
  const allForms = await db.select({ id: forms.id, name: forms.name }).from(forms).where(eq(forms.eventId, event.id));
  for (const f of allForms) {
    if (!keepForms.includes(f.name)) await db.update(forms).set({ active: false }).where(eq(forms.id, f.id));
  }
  console.log(`[content] ${cfg.forms.length} forms`);

  // 4. Jury: replaced wholesale. Confidential — no chat tool reads this table.
  await db.delete(jury).where(eq(jury.eventId, event.id));
  if (cfg.jury.length) {
    await db.insert(jury).values(cfg.jury.map((j) => ({ eventId: event.id, name: j.name, details: j.details ?? null, confidential: j.confidential })));
  }
  console.log(`[content] ${cfg.jury.length} jury members (confidential)`);

  // 5. Edition knowledge documents.
  const files = markdownFiles(dir);
  for (const file of files) {
    const { data, body } = parseFrontMatter(fs.readFileSync(file, "utf8"));
    const meta = docMetaSchema.parse(data);
    await upsertDocument({ eventId: event.id, scope: "event", title: titleFrom(meta, body, file), body, meta, file });
  }
  console.log(`[content] ${files.length} edition documents`);
}

export interface LoadContentOptions {
  event?: string | null;
  evergreenOnly?: boolean;
}

export async function loadContent(opts: LoadContentOptions = {}): Promise<void> {
  const n = await loadEvergreen();
  console.log(`[content] ${n} evergreen documents`);
  if (opts.evergreenOnly) return;
  const slug = opts.event ?? process.env.ACTIVE_EVENT_ID;
  if (!slug) throw new Error("No edition given: pass --event <ID> or set ACTIVE_EVENT_ID.");
  await loadEdition(slug);
}

function parseArgs(argv: string[]): LoadContentOptions {
  const opts: LoadContentOptions = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--event") opts.event = argv[++i] ?? null;
    else if (argv[i] === "--evergreen-only") opts.evergreenOnly = true;
  }
  return opts;
}

const isDirectRun = process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false;
if (isDirectRun) {
  loadContent(parseArgs(process.argv.slice(2)))
    .then(() => console.log("[content] done"))
    .catch((err) => {
      console.error("[content] failed:", err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
