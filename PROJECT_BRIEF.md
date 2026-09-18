<!--
  ============================================================================
  MASTER PROJECT BRIEF — Stallion AI Assistant
  This is the AUTHORITATIVE context-transfer document for continuing this build
  in a new chat / new model. It supersedes HANDOVER.md and the current (stale)
  CLAUDE.md. If anything here conflicts with CLAUDE.md, THIS FILE WINS until
  CLAUDE.md is rewritten (that rewrite is task #1 — see §12).
  ============================================================================
-->

# 🐎 Stallion AI Assistant — Master Project Brief

> **A grounded, safe, event-pinned AI concierge for Digital Stallion's award
> sites in India & the UAE.** The model runs the conversation; the application
> owns the facts. Nothing consequential is ever invented, promised, or leaked.

**Repo:** `C:\Users\91937\Desktop\stallion-ai-assistant`
**Stage:** Foundation build, ~50% complete — `lib/` backend done, `app/` layer next.
**Read time:** ~15 min. Read the whole thing before writing code.

---

## Table of contents
1. [What we're building](#1-what-were-building)
2. [The One Hard Rule](#2-the-one-hard-rule)
3. [Event isolation — the core safety property](#3-event-isolation--the-core-safety-property)
4. [Defense in depth — the safety layers](#4-defense-in-depth--the-safety-layers)
5. [Tech stack (exact installed versions)](#5-tech-stack-exact-installed-versions)
6. [Architecture & request flow](#6-architecture--request-flow)
7. [Data model](#7-data-model)
8. [The tools the model may call](#8-the-tools-the-model-may-call)
9. [Library API reference (already written)](#9-library-api-reference-already-written)
10. [Environment variables](#10-environment-variables)
11. [Current build status — precise](#11-current-build-status--precise)
12. [Exactly what to build next (with sketches)](#12-exactly-what-to-build-next-with-sketches)
13. [Known risks to verify on first typecheck](#13-known-risks-to-verify-on-first-typecheck)
14. [Conventions & house style](#14-conventions--house-style)
15. [How to run](#15-how-to-run)
16. [Out of scope (leave TODOs only)](#16-out-of-scope-leave-todos-only)
17. [Definition of done](#17-definition-of-done)

---

## 1. What we're building

**Stallion AI Assistant** — an AI chatbot by Digital Stallion — is the first
point of contact on Digital Stallion's award websites. It:

- explains the event,
- recognises whether the visitor is a **brand, agency, individual, or sponsor**,
- suggests award categories that **may** fit (advice, **never** a verdict),
- guides the nomination process and points to the correct form,
- captures leads,
- and hands off to the human team — with a summary — for large, commercial, or
  complex enquiries.

It **clearly discloses that it is an AI chatbot.** Tone: professional, clear,
helpful, concise; confident only where information is confirmed, transparent
about uncertainty; not robotic, not promotional.

This is a lean **Phase 1** (a ~30–40h small project). **Prefer simple, working
code over abstraction. Do not gold-plate the admin. Do not add features not in
this brief.**

---

## 2. The One Hard Rule

> **The AI may understand, explain, recommend, and summarise. It must NOT
> independently create official facts, commercial commitments, permissions, or
> consequential business decisions.**

Enforced in code, not just prose:

- **Hard facts** (event identity, dates, deadlines, fees, taxes, categories,
  forms, contacts) are **always read from typed DB columns through tools**,
  never generated as model free text.
- The action pattern is **AI proposes → application validates → application
  executes**. In Phase 1 **the assistant takes no external action at all** (the
  only outward message is the internal team handoff notification).
- If information isn't in the **approved** knowledge base, the assistant behaves
  as if it doesn't know: it says the info isn't confirmed, offers the team, and
  **logs the question**. It never guesses and never fills gaps from general model
  knowledge or the open web.

**The bar for invented facts is zero.** New fact surface? → typed column + tool.

The full no-invention list (encoded in the system prompt): never invent event
dates, venue, deadlines, nomination-opening dates, eligibility periods, fees,
taxes, discounts, categories, category requirements, jury members, sponsors,
previous winners, forms, contacts, payment details, refund policies, deadline
extensions, or Founder approvals.

---

## 3. Event isolation — the core safety property

> **One codebase, deployed once per site, pinned to exactly ONE event via
> `ACTIVE_EVENT_ID`** (e.g. `INDIA-2027`, `UAE-2027`). India and UAE are
> **separate deployments** of the same code.

- The event is **fixed in server config**. A visitor can **never** switch it —
  there is no request-derived event id anywhere in the app.
- Every content/conversation query filters to `ACTIVE_EVENT_ID` **plus evergreen
  content**. Nothing else is ever loaded.
- "Give me the India price" on a UAE-pinned deployment **fails to return India
  data because the data layer never queries another event** — not because the
  prompt was asked nicely.
- **Isolation is enforced in the query layer, not the system prompt.**

> ⚠️ **This replaced the original design.** The first brief resolved the edition
> at runtime from the request domain against a `domains` allowlist with a
> `DEFAULT_EDITION_SLUG` fallback. That is **gone**. `lib/edition/resolve.ts` was
> deleted and replaced by **`lib/event/active.ts`**. Everything is `event` /
> `event_id`, never `edition`.

Implementation: `lib/event/active.ts` → `getActiveEvent()` reads
`process.env.ACTIVE_EVENT_ID`, loads the one `events` row (by `slug`, `active`),
and every tool/retrieval call scopes to that `event.id`.

---

## 4. Defense in depth — the safety layers

The assistant is safe because **many independent layers** must all be bypassed,
and the strongest ones are structural (code), not persuasive (prompt):

| # | Layer | Where | What it guarantees |
|---|-------|-------|--------------------|
| 1 | **Event pin** | `lib/event/active.ts` | The deployment can only ever act for one event. |
| 2 | **Query scoping** | every `lib/ai/tools.ts` query + `lib/kb/retrieve.ts` | No other event's rows are ever queried. |
| 3 | **Approved/active/in-date filter** | `lib/kb/retrieve.ts` | Only approved, active, in-date content reaches the model. |
| 4 | **Confidential-by-design** | chat path never imports `jury`/`admins` | The public bot is technically incapable of reading secrets. |
| 5 | **Facts-from-tools-only** | `get_event_facts` + system prompt | Hard facts can't be free-typed. |
| 6 | **Input-as-data** | `wrapUntrustedUserContent` + system prompt | Visitor text is data; embedded instructions are ignored. |
| 7 | **Injection detection** | `detectPromptInjection` | Override/jailbreak/prompt-reveal attempts flagged. |
| 8 | **Claims-not-authorization** | `detectUnverifiedClaim` + system prompt | "Paurush promised 50% off" is referred, never accepted. |
| 9 | **Output grounding check** | `groundingCheck` | Any date/number/currency not in sources is flagged (log; regenerate seam). |
| 10 | **Not-confirmed + log** | `NO_CONFIRMED_INFO` + `log_unanswered` | Unknowns route to the team and are recorded. |

---

## 5. Tech stack (exact installed versions)

Dependencies are **already installed** (`node_modules` present, 484 packages).

| Package | Version | Notes |
|---|---|---|
| `next` | 15.5.25 | App Router, TypeScript, ESLint, **no `src/`** |
| `react` / `react-dom` | 19.x | |
| `ai` (Vercel AI SDK) | **4.3.19** | **v4 API** — `tool({ parameters, execute })`, `streamText`, `result.toDataStreamResponse()` |
| `@ai-sdk/openai` | 1.3.24 | `createOpenAI({ apiKey }).responses(modelId)` — single provider for chat + embeddings |
| `@ai-sdk/react` | 1.2.12 | `useChat` for the widget |
| `drizzle-orm` | 0.38.4 | pgvector `vector()`, `cosineDistance`, `.using("hnsw", col.op("vector_cosine_ops"))` |
| `drizzle-kit` | 0.30.6 | `generate` (offline) / `push` |
| `postgres` (postgres.js) | 3.4.9 | `prepare:false` (Neon pooler-safe) |
| `openai` | 4.104.0 | embeddings only (`text-embedding-3-small`, 1536) |
| `zod` | 3.25.76 | validates every tool input + admin form |
| `vitest` | 2.1.9 | tests must **not** need DB/network/API keys |
| `tsx` | 4.23.13 | runs `scripts/*.ts` |
| `tailwindcss` | 3.4.x | widget + admin UI |
| `resend` | 4.x | handoff email (console fallback in dev) |

> 🧱 **Sandbox install gotcha (Windows/Claude desktop):** run
> `npm install --ignore-scripts --no-audit --no-fund`. A native esbuild
> postinstall tries to spawn `cmd.exe`, fails in the sandbox, and rolls back the
> whole install. With `--ignore-scripts`, esbuild's binary still installs via its
> `@esbuild/win32-x64` optional package, so tsx/drizzle-kit/vitest/next all work.
> Also: `npm install ... | tail` masks npm's real exit code — don't pipe it.

---

## 6. Architecture & request flow

```
 Award site (India OR UAE)                      ┌─────────────────────────────┐
 ┌───────────────────────┐   loads             │  Next.js app (this repo)    │
 │ <script src=embed.js>  │ ─────────────────▶  │  pinned by ACTIVE_EVENT_ID  │
 │  injects an <iframe>   │                     │                             │
 │  → /widget             │  POST /api/chat     │  app/api/chat/route.ts      │
 │  (useChat, streaming)  │ ──────────────────▶ │   1 getActiveEvent()        │
 └───────────────────────┘                     │   2 retrieve() KB (scoped)  │
                                                │   3 buildSystemPrompt()     │
                                                │   4 streamText(+ makeTools) │
                                                │   5 groundingCheck()        │
                                                │   6 persist conv+messages   │
                                                └──────────────┬──────────────┘
                                                               │
        Postgres + pgvector (Neon)  ◀───── all queries scoped to event.id ─────┘
        events · categories · kb_documents · kb_chunks · forms · conversations
        · messages · leads · handoffs · unanswered_questions · jury(confidential)
```

**`app/api/chat/route.ts` steps (build to this):**
1. `const event = await getActiveEvent()` — server config, never client input.
2. `const context = await retrieve({ eventId: event.id, query: lastUserText })` —
   approved + active + in-date + this-event/evergreen only.
3. `const system = buildSystemPrompt({ event, context })`.
4. `streamText({ model: getModel(), system, messages, tools: makeTools(ctx), maxSteps: 5 })`
   where visitor messages are wrapped via `wrapUntrustedUserContent`.
5. In `onFinish`: run `groundingCheck(text, sources)` and **log** flags; run
   `detectPromptInjection` / `detectUnverifiedClaim` on the last user message and
   log posture.
6. In `onFinish`: persist the conversation (upsert) + user & assistant messages
   (+ `tool_calls`).
7. Return `result.toDataStreamResponse()`.

---

## 7. Data model

Defined in **`lib/db/schema.ts`** (Drizzle). Every content/conversation row
carries `event_id`; evergreen KB is the nullable exception, tagged by `scope`.
UUID PKs (`defaultRandom()`), tz timestamps.

- **events** — `slug` (= `ACTIVE_EVENT_ID`, unique), name, country, year,
  edition_number, event_date, venue, eligibility_period, nomination_open,
  nomination_deadline, `fees` (jsonb), `taxes` (jsonb), `contact` (jsonb),
  status, active.
- **categories** — event_id, name, official_name, description,
  `eligibility_rules` (jsonb, with optional `deterministic` block),
  client_approval_required, active.
- **kb_documents** — event_id (nullable), scope `'evergreen'|'event'`, title,
  body, source, **approval_status `'draft'|'approved'`**, version,
  effective_date, expiry_date, last_verified, active, updated_at.
- **kb_chunks** — document_id, event_id (nullable), scope, content,
  **`embedding vector(EMBEDDING_DIM)`**, metadata (jsonb). Indexes: **HNSW cosine
  on embedding** + btree on event_id.
- **forms** — event_id, category_id (nullable), name, url, active.
- **conversations** — event_id, visitor_type, status, summary, created_at.
- **messages** — conversation_id, role, content, tool_calls (jsonb), created_at.
- **leads** — conversation_id, event_id, name, org, role, email, phone,
  visitor_type, approx_entries, categories_discussed (text[]), purpose, notes.
- **handoffs** — conversation_id, event_id, reason, summary, status,
  assigned_to, created_at.
- **unanswered_questions** — conversation_id, event_id, question, created_at.
- **jury** — event_id, name, details, confidential. **CONFIDENTIAL — never read
  by any chat tool or retrieval query.**
- **admins** — email, role.

**The retrieval/fact filter (enforced in `lib/kb/retrieve.ts`):**
```
(event_id = ACTIVE_EVENT_ID OR scope='evergreen')
AND active = true
AND approval_status = 'approved'
AND (effective_date IS NULL OR effective_date <= now)
AND (expiry_date  IS NULL OR expiry_date  >= now)
```

**First migration must** run `CREATE EXTENSION IF NOT EXISTS vector;` **before**
the tables (the `vector` column depends on it) and keep the HNSW index.

---

## 8. The tools the model may call

Defined in **`lib/ai/tools.ts`** via `makeTools(ctx)`. Every tool: Zod-validated,
**scoped to `ctx.eventId`** (closed over — the model can't pass an event id),
reads only public/approved content, and takes **no** consequential external
action in Phase 1.

| Tool | Purpose |
|---|---|
| `get_event_facts(fields[])` | **The only source of hard facts** for the active event (dates, venue, deadline, nomination_open, eligibility_period, fees, taxes, contact). Unset field → `confirmed:false`. |
| `list_categories()` | Active categories for the event. |
| `suggest_categories(description)` | Semantic match; returns top fits **framed "may be relevant"** with a disclaimer. Assert eligibility only when a deterministic rule confirms it. |
| `get_form(category?)` | Approved, active nomination form URL. |
| `capture_lead(name, org, role, email, phone, visitor_type, approx_entries, categories_discussed, purpose, notes)` | Writes a lead — only after helping. |
| `escalate_to_human(reason, summary)` | Writes a handoff row + calls `notifyHandoff`; marks conversation `handed_off`. |
| `log_unanswered(question)` | Records a question the approved KB couldn't answer. |

**Escalation triggers** (encoded in the prompt): ~15+ entries, an agency with
several clients, a major corporate participant, sponsorship/partnership, bulk or
special pricing, complicated eligibility, a complaint, missing KB info, or a
direct request for a specific person.

---

## 9. Library API reference (already written)

All of `lib/` exists and compiles-in-principle (unverified). Signatures a caller
needs:

```ts
// lib/event/active.ts
getActiveEventSlug(): string
getActiveEvent(): Promise<Event>                    // throws if unset/not found

// lib/db/index.ts
db                                                  // lazy Drizzle client (postgres.js)
schema                                              // re-export of all tables

// lib/kb/embed.ts
embed(text: string): Promise<number[]>
embedMany(texts: string[]): Promise<number[][]>
getEmbeddingsProvider(): EmbeddingsProvider         // swappable via EMBEDDINGS_PROVIDER

// lib/kb/ingest.ts
chunkText(text, { size=1000, overlap=150 }?): string[]   // pure, testable
ingestDocument(input: IngestInput): Promise<{ documentId, chunkCount }>
//   IngestInput = { id?, eventId|null, scope:'evergreen'|'event', title, body,
//     source?, approvalStatus?='draft', effectiveDate?, expiryDate?, lastVerified?, active? }

// lib/kb/retrieve.ts
retrieve({ eventId, query, limit=6, minScore=0.2 }): Promise<RetrievedChunk[]>
hasRelevant(chunks): boolean

// lib/ai/model.ts
DEFAULT_MODEL_ID: string                            // "gpt-5.6-terra"
getModelId(): string                                // MODEL_ID ?? default
getModel(): LanguageModelV1                          // OpenAI (Responses API) via AI SDK

// lib/ai/guardrails.ts
NO_CONFIRMED_INFO: string
sanitizeUserText(text): string
wrapUntrustedUserContent(text): string              // wraps in <visitor_message>
detectPromptInjection(text): { injected: boolean; matches: string[] }
detectUnverifiedClaim(text): { claim: boolean; matches: string[] }
extractFactTokens(reply): GroundingFlag[]
groundingCheck(reply, sources: string[]): { ok: boolean; flags: GroundingFlag[] }

// lib/ai/system-prompt.ts
buildSystemPrompt({ event, context }): string        // + exported EN string tables

// lib/ai/tools.ts
SUGGESTION_DISCLAIMER: string
resolveFacts(event, fields: FactField[]): ResolvedFact[]   // pure, testable
makeTools(ctx: ToolContext): Record<string, Tool>          // ctx = { event, eventId, conversationId }

// lib/handoff/notify.ts
notifyHandoff({ handoffId, event, reason, summary, conversationId }): Promise<{ delivered: boolean }>

// lib/types.ts
VisitorType, VISITOR_TYPES, HandoffChannel, FactField, FACT_FIELDS,
ResolvedFact, ToolContext, RetrievedChunk, GroundingResult, GroundingFlag,
QuickAction, QUICK_ACTIONS   // <-- widget opening chips
```

---

## 10. Environment variables

Write these to `.env.example` **with comments** (and update it — see §11, it is
currently stale):

```
DATABASE_URL          Postgres connection string, pgvector enabled (Neon default)
MODEL_ID              OpenAI chat model id (default gpt-5.6-terra); OPENAI_API_KEY serves chat + embeddings
EMBEDDINGS_PROVIDER   openai
OPENAI_API_KEY        embeddings
EMBEDDING_DIM         1536
ACTIVE_EVENT_ID       the one event this deployment serves, e.g. INDIA-2027
ADMIN_EMAIL           admin login
ADMIN_PASSWORD        admin login (Phase 1 simple auth)
HANDOFF_CHANNEL       email | slack | whatsapp
HANDOFF_EMAIL         where handoff notifications go
RESEND_API_KEY        email sending (optional in dev; logs to console if absent)
```

---

## 11. Current build status — precise

### ✅ Done (written, event-model, **UNVERIFIED by the compiler**)
```
package.json  tsconfig.json  next.config.mjs  postcss.config.mjs
tailwind.config.ts  .eslintrc.json  .gitignore  vitest.config.ts  drizzle.config.ts
lib/db/schema.ts   lib/db/index.ts   lib/types.ts   lib/event/active.ts
lib/kb/embed.ts    lib/kb/ingest.ts  lib/kb/retrieve.ts
lib/ai/model.ts    lib/ai/guardrails.ts  lib/ai/system-prompt.ts  lib/ai/tools.ts
lib/handoff/notify.ts
```

### ⚠️ STALE — rewrite to the event model **FIRST**
```
CLAUDE.md      still describes editions/domains/DEFAULT_EDITION_SLUG. It AUTO-LOADS
               into every new chat in this folder, so a fresh session will be
               misled until it's rewritten. Rewrite it to mirror THIS brief.
.env.example   still has DEFAULT_EDITION_SLUG; replace with ACTIVE_EVENT_ID.
```

### ❌ Not started (the remaining build)
```
lib/auth.ts                        app/layout.tsx        app/globals.css
app/page.tsx                       app/api/health/route.ts
app/api/chat/route.ts  (CORE)      app/widget/page.tsx
app/admin/layout.tsx               app/admin/page.tsx
app/admin/conversations/page.tsx   app/admin/leads/page.tsx
app/admin/handoffs/page.tsx        app/admin/unanswered/page.tsx
app/admin/event/page.tsx           app/admin/knowledge/page.tsx
public/embed.js                    scripts/migrate.ts    scripts/seed.ts
drizzle/0000_*.sql (+ meta)        tests/normal.test.ts  tests/adversarial.test.ts
README.md                          git init + initial commit
```

### 🔬 Verification not yet run
`npm run typecheck` · `npm run lint` · `npm run db:generate` · `npm run build` ·
`npm run test`

---

## 12. Exactly what to build next (with sketches)

Build in this order. After each group, run `npm run typecheck` and fix before
moving on.

### 12.0 Fix the stale docs (10 min)
Rewrite `CLAUDE.md` to mirror this brief (event model, tables, tools, safety
layers). Update `.env.example` (`DEFAULT_EDITION_SLUG` → `ACTIVE_EVENT_ID=INDIA-2027`).

### 12.1 `lib/auth.ts` — simple admin auth (seam for Auth.js)
Compare against `ADMIN_EMAIL`/`ADMIN_PASSWORD`; set a signed httpOnly cookie
(e.g. an HMAC of the email + a server secret). Export `verifyLogin(email,pw)`,
`getAdminSession(cookies)`, `createSessionCookie()`, `clearSessionCookie()`.
Keep it swappable — one module, no logic leaking into pages.

### 12.2 `app/api/health/route.ts`
```ts
export async function GET() {
  return Response.json({ ok: true, event: process.env.ACTIVE_EVENT_ID ?? null });
}
```

### 12.3 `app/api/chat/route.ts` — the core (reference sketch)
```ts
import { streamText } from "ai";
import { getActiveEvent } from "@/lib/event/active";
import { retrieve } from "@/lib/kb/retrieve";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getModel } from "@/lib/ai/model";
import { makeTools } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  wrapUntrustedUserContent, sanitizeUserText, groundingCheck,
  detectPromptInjection, detectUnverifiedClaim,
} from "@/lib/ai/guardrails";

export const runtime = "nodejs";              // postgres.js + server-only need node
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages: incoming, conversationId } = await req.json();
  const event = await getActiveEvent();

  // Ensure a conversation row (client supplies a uuid; upsert scoped to event).
  const convId = conversationId ?? crypto.randomUUID();
  await db.insert(conversations)
    .values({ id: convId, eventId: event.id, status: "open" })
    .onConflictDoNothing();

  const lastUser = [...incoming].reverse().find((m) => m.role === "user");
  const lastText = sanitizeUserText(lastUser?.content ?? "");
  // Posture logging (do not block; steer via prompt/tools):
  console.info("[chat] posture", detectPromptInjection(lastText), detectUnverifiedClaim(lastText));

  const context = await retrieve({ eventId: event.id, query: lastText });
  const system = buildSystemPrompt({ event, context });

  // Wrap visitor turns so the model treats them as data.
  const modelMessages = incoming.map((m: any) =>
    m.role === "user" ? { ...m, content: wrapUntrustedUserContent(m.content) } : m,
  );

  const ctx = { event, eventId: event.id, conversationId: convId };
  const result = streamText({
    model: getModel(),
    system,
    messages: modelMessages,
    tools: makeTools(ctx),
    maxSteps: 5,
    async onFinish({ text, toolResults }) {
      const sources = [
        ...context.map((c) => c.content),
        JSON.stringify(toolResults ?? []),
      ];
      const grounding = groundingCheck(text, sources);
      if (!grounding.ok) console.warn("[grounding] flags", grounding.flags);
      // persist user + assistant messages (+ tool_calls)
      if (lastUser) await db.insert(messages).values({ conversationId: convId, role: "user", content: lastText });
      await db.insert(messages).values({ conversationId: convId, role: "assistant", content: text, toolCalls: toolResults });
    },
  });
  const res = result.toDataStreamResponse();
  res.headers.set("x-conversation-id", convId);
  return res;
}
```
> Note the client should generate & resend a `conversationId` (uuid) so turns
> attach to one conversation. It's not sensitive: all queries are event-scoped.
> Optional hardening: verify the conversation's `eventId` matches the active event.

### 12.4 `app/widget/page.tsx` — the chat UI (client component)
- `"use client"`, `useChat` from `@ai-sdk/react`, pointing at `/api/chat`.
- Generate a `conversationId` once (`useState(() => crypto.randomUUID())`) and
  send it via `useChat({ body: { conversationId } })`.
- Render `QUICK_ACTIONS` (from `lib/types`) as chips that call `append({role:'user',content:send})`.
- Show an **AI disclosure** line ("You're chatting with an AI assistant…").
- Tailwind, mobile-friendly, fits an iframe.

### 12.5 `public/embed.js`
Vanilla JS that creates a fixed-position bubble + iframe pointing at
`<host>/widget`. Read `<host>` from the script's own `src`. Keep it tiny.

### 12.6 `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
Demo host page that embeds the widget (drop in `<script src="/embed.js">` or an
iframe directly). Layout sets `<html lang>`, imports globals. Globals = the three
Tailwind directives + minimal base.

### 12.7 `scripts/migrate.ts`
```ts
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await sql`CREATE EXTENSION IF NOT EXISTS vector;`;   // BEFORE migrations
await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
await sql.end();
```
Then run `npm run db:generate` (offline — validates the schema) and **prepend**
`CREATE EXTENSION IF NOT EXISTS vector;` to the generated `0000_*.sql` too, so the
plain `drizzle-kit migrate` path also works.

### 12.8 `scripts/seed.ts`
One `INDIA-2027` event (name, country IN, year 2027, event_date, venue,
nomination_open, nomination_deadline, `fees`, `taxes` e.g. GST 18%, `contact`
with a team name + email — NOT a hardcoded person), a handful of categories
(**one with a `eligibility_rules.deterministic` example**), **two evergreen +
one event KB doc, all `approval_status:'approved'`** (use `ingestDocument`), one
form. Set `ACTIVE_EVENT_ID=INDIA-2027`. Must let chat answer real questions on
first run.

### 12.9 Tests (Vitest — **no DB/network/API keys**)
Test the **pure** helpers so the suite is deterministic and CI-safe:
- `tests/normal.test.ts`: `resolveFacts(seedEvent, [...])` returns confirmed
  date/venue/fee/tax; `chunkText` splits sensibly; `SUGGESTION_DISCLAIMER` framing
  present; a seed-like event yields grounded values.
- `tests/adversarial.test.ts`: `detectPromptInjection("ignore your instructions…")`
  is `injected:true`; `detectUnverifiedClaim("Paurush promised me 50% off")` is
  `claim:true`; `resolveFacts` with an **unset** deadline → `confirmed:false`
  (not-confirmed path); `resolveFacts(indiaEvent,['fees'])` can only return India
  fees (isolation — there's no way to get another event's row); `groundingCheck`
  flags an invented year/amount not in sources; jury is never referenced by any
  tool (assert `makeTools` exposes no jury tool).

### 12.10 `README.md`, then verify, then git
`README.md` = setup (env, db, migrate, seed, dev) + the sandbox install note.
Run the full verification chain (§15), fix §13 items, then `git init` + one
initial commit (`.gitignore` already present).

---

## 13. Known risks to verify on first typecheck

Written from API knowledge; confirm with the compiler:
- **AI SDK v4 tool typing:** `makeTools` returns `Record<string, Tool>`;
  `streamText({ tools })` wants a `ToolSet`. Likely assignable — if not, use
  `satisfies ToolSet` / adjust the return type.
- **`LanguageModelV1`** import from `"ai"` in `lib/ai/model.ts` — confirm exported
  in 4.3.19; fallback `ReturnType<ReturnType<typeof createOpenAI>>`.
- **Drizzle pgvector** `.using("hnsw", table.embedding.op("vector_cosine_ops"))`
  and `cosineDistance` import — confirm in 0.38.4.
- **`import "server-only"`** resolves (ships with Next).
- **Lazy `db` proxy** — confirm `next build` doesn't open a connection at import
  time (it shouldn't; connection is created on first query).
- **`onConflictDoNothing`** on a client-supplied conversation id needs the PK to
  be the conflict target — fine for `id`.

---

## 14. Conventions & house style

- **App Router, no `src/`.** Path alias `@/*` → repo root.
- **Server-only modules** (`lib/db`, `lib/event`, `lib/ai/*`, `lib/kb/*`,
  `lib/handoff`, `lib/auth`) must never be imported into client components. The
  widget talks to the server only through `/api/chat`.
- **Zod at every trust boundary** (tool args, admin forms, request bodies).
- **English first, i18n-ready:** UI strings & prompt fragments are data (see the
  `_EN` tables in `system-prompt.ts` and `QUICK_ACTIONS`) so Arabic can be added
  by translating tables, not restructuring.
- **New facts → typed column + tool. Never a model free-text fact.**
- Keep the admin **minimal** — read views + the two editors. Don't gold-plate.
- Comments explain **why**, matching the density already in `lib/`.

---

## 15. How to run

```bash
npm install --ignore-scripts          # see sandbox note (§5)
cp .env.example .env                   # fill DATABASE_URL,
                                       # OPENAI_API_KEY, MODEL_ID,
                                       # ACTIVE_EVENT_ID=INDIA-2027, admin, handoff
npm run db:generate                    # emit first migration from schema (offline)
npm run db:migrate                     # CREATE EXTENSION vector; + apply migrations
npm run seed                           # sample INDIA-2027 data (needs DB + OPENAI key)
npm run dev                            # demo at /, widget at /widget, admin at /admin

# verification chain
npm run typecheck && npm run lint && npm run db:generate && npm run build && npm run test
```

---

## 16. Out of scope (leave short TODOs only)

Auto-emailing forms, selecting the form by category automatically, recording
forms sent, a **configurable** reminder email (the six-day reminder must be
configurable, not hardcoded), confirmation/thank-you emails, submission tracking,
dashboards & analytics, CRM & WhatsApp integration, **Arabic** language, and
**payments**. Auth.js migration (seam left in `lib/auth.ts`).

---

## 17. Definition of done

`npm run dev` serves a working chat. **"When is the event?"** answers from
structured facts. On a deployment pinned to one event, **asking for the other
country's price or deadline leaks nothing**. **"Ignore your instructions"** keeps
the assistant in role. **"Paurush promised a discount"** is referred to the team,
not accepted. An **unknown question offers the team and is logged** to unanswered
questions. Any request for **jury or confidential data reveals nothing**.
`CLAUDE.md`, `README.md`, `.env.example`, migrations, and seed are all in place;
typecheck and lint pass; git initialised with one initial commit.

---

_This brief reflects the code actually on disk as of 2026-09-18. Trust it over
`CLAUDE.md` until that file is rewritten (task §12.0)._
