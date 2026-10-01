# Digital Stallion AI Sales Assistant — Continuity Register

**Status:** ACTIVE  
**Last updated:** 2026-10-01  
**Repository:** `rakeshghumatkar1/stallion-ai-demo`  
**Production:** https://stallion-ai-demo.vercel.app  
**Baseline main commit when this register was created:** `66e5923d6be20be3d026842dcd5d11e5a17d186d`

> This file is the cross-chat development checkpoint. It is a navigation/status document, not a higher authority than the code or approved client sources. If this register conflicts with current GitHub code, GitHub wins for what is implemented.

## 1. Required source order

Before meaningful development work:

1. Read Section 0 of **"00 - READ FIRST - Digital Stallion AI Sales Assistant - Admin and Knowledge Development Concept v1.1"** in the ChatGPT Project Sources.
2. Inspect current GitHub code and current branch/commit.
3. Apply **Think Big Digital AI Agent Standard — TBD-AAS v1.0** for engineering, governance and production rules.
4. Use the **Research & Implementation Blueprint** for detailed technical guidance.
5. Apply the **Digital Stallion AI Sales Assistant — Client Implementation Specification v1.0** for client-specific behaviour.
6. Use only the latest clearly FINAL / APPROVED / CURRENT Digital Stallion material for current facts, categories, URLs and sales content.
7. Use the **Admin & Knowledge Management Development Concept v1.1** for the approved next-development direction.
8. Use old chats, drafts and old client material only for historical context.

If two current approved client sources conflict, do not guess. Surface the conflict for human resolution.

## 2. Business objective

This is not a generic FAQ bot. It is a sales assistant for Digital Stallion awards.

Primary visitor journey:

**Understand the awards → discover relevant categories → resolve questions/objections → click NOMINATE / open the approved nomination form.**

Lead capture and human handoff are supporting conversion paths.

The assistant may be conversational and persuasive, but it must not invent official categories, dates, prices, eligibility, URLs, action outcomes or other authoritative facts.

## 3. Current implementation snapshot

The existing system is a working Next.js/Vercel chatbot, not a greenfield build.

Current foundation includes:

- Next.js App Router / TypeScript application.
- Responsive desktop/mobile chatbot widget and embed.
- OpenAI/Vercel AI SDK integration.
- Behaviour/system prompt architecture.
- Hard UAE/Dubai event isolation in the current public path.
- Structured event-fact tool.
- Category listing and category suggestion tools.
- Lead capture, unanswered-question logging and human handoff tools.
- Postgres/Drizzle data model for events, categories, knowledge, conversations, leads and handoffs.
- Existing knowledge ingestion/vector infrastructure and basic admin pages.
- Prompt-injection/claim guardrails and answer-state handling.
- GitHub → Vercel deployment and rollback foundation.
- Unit/adversarial/live test foundations.

## 4. Important current architecture limitation

The public chatbot currently uses a partly static UAE knowledge path:

- `lib/kb/retrieve.ts` reads `UAE_KNOWLEDGE_SECTIONS` from application files.
- Category tools use `UAE_CATEGORIES` / `rankUaeCategories` from `lib/demo/uae-knowledge.ts`.
- Existing DB/admin knowledge ingestion exists separately.

Therefore the admin/knowledge editor is **not yet the true control surface for what the public chatbot knows**.

The target is evolutionary: reconnect and govern these pieces rather than rewrite the application.

## 5. Known P0 issues from the 2026-09-30 / 2026-10-01 audit

### P0-1 — Handoff action truthfulness
Current `escalate_to_human` writes the handoff, calls `notifyHandoff()`, ignores its `delivered` result and always returns success wording:

> "I've passed this to the team with a summary — they'll follow up with you."

But `notifyHandoff()` can return `delivered:false` when email is not configured, provider delivery fails, or Slack/WhatsApp is selected but not implemented.

**Required:** never claim delivery/success unless the underlying system confirms it.

### P0-2 — Final category governance
The live code still relies on the older static UAE category set. The revised client category document contains the newer approved category structure.

**Important unresolved conflict:** revised category material is labelled Middle East 2026 while the current assistant scope is UAE/Dubai 2027. Do not silently rename years. Human decision required before final migration.

### P0-3 — Governed knowledge path
Reconnect public retrieval to one authoritative, approved current knowledge path with current/archive separation, source metadata, approvals and versioning.

### P0-4 — Consent / lead action guard
Current lead capture behaviour relies too heavily on prompt-level instructions. Explicit consent/action state should become application-owned and server validated.

### P0-5 — Current regression suite
`tests/questions/normal.json` still contains India-era expectations such as INR 15,000 and an India nomination URL. The live release suite must be rebuilt for the current UAE/Digital Stallion configuration.

## 6. Preserve — do not unnecessarily rebuild

Keep and improve the existing:

- Next.js/Vercel application.
- Chat widget/embed.
- deterministic main menu/restart behaviour.
- closed-world / unsupported-answer handling.
- typed event facts.
- event isolation concept.
- safe rendering.
- Zod-validated tools.
- prompt-injection controls.
- unanswered-question capture.
- existing Postgres/Drizzle foundation.
- existing admin foundation.
- GitHub → Vercel Preview → review → production workflow.

## 7. Approved next product direction

Build the **Stallion AI Control Centre** inside the existing application.

Planned modules:

1. Dashboard
2. Knowledge Studio
3. AI Review
4. Questions for Client
5. Structured Facts
6. Award Categories
7. Sales Playbook
8. Test Centre
9. Publish & Versions
10. Reports
11. Users & Roles

Core non-technical workflow:

**Upload source → classify source → AI audit → identify conflicts/gaps → ask admin questions → AI proposes knowledge changes → human review/approval → draft tests → Preview → publish → measure NOMINATE conversion.**

Uploaded material must never auto-publish.

## 8. Development sequence

### Phase A — Stabilise current assistant
- Fix handoff truthfulness.
- Establish final/current Digital Stallion source set.
- Replace obsolete category data after the year/edition conflict is resolved.
- Rebuild UAE regression suite.

### Phase B — Knowledge Studio
- Upload documents.
- Source metadata.
- AI source audit.
- Missing-information questions.
- Review/approve workflow.
- Current/archive separation.

### Phase C — Publish + Test Centre
- Draft knowledge versions.
- Test chat.
- Regression checks.
- Vercel Preview.
- Human approval.
- Publish/rollback.

### Phase D — Sales Intelligence
- Structured visitor/qualification state.
- Better category recommendation.
- Contextual CTAs.
- NOMINATE/form-click tracking.
- High-value routing.

### Phase E — Reporting & Client Access
- Funnel and quality reports.
- Knowledge-gap reporting.
- Viewer/editor roles for Digital Stallion.

### Phase F — Reusable Think Big Digital Core
Only after Digital Stallion is stable, extract reusable components for future clients.

## 9. Current pending client/business decisions

Do not guess these:

- Active public year/edition wording versus revised category document labelled 2026.
- Final approved nomination form URL(s).
- Confirmed current event facts still missing or "to be announced".
- Final editor/publisher/viewer permissions for Digital Stallion users.
- Whether website URL import is required in the first Knowledge Studio release.
- Essential upload formats for first launch.
- Whether failed handoffs / critical knowledge gaps need email alerts.
- Whether conversion tracking can observe only nomination-form clicks or also successful form submissions.

## 10. Current testing note

The existing tests are useful foundations, but the current live question suite is not authoritative for the UAE/Digital Stallion release because some cases still contain India-specific facts and URLs.

Do not treat a passing old suite as production acceptance.

## 11. NEXT TASK

### TASK 1 — Fix handoff action truthfulness

**Problem**  
`lib/ai/tools.ts` currently ignores the delivery result from `lib/handoff/notify.ts` and returns success wording even when notification delivery fails.

**Goal**  
Return truthful application-owned status. Do not claim "sent", "passed to the team", "delivered" or equivalent unless confirmed.

**Likely files**
- `lib/ai/tools.ts`
- `lib/handoff/notify.ts`
- relevant unit/tool tests
- schema/status only if a minimal safe status adjustment is required

**Required tests**
- delivered=true → success wording may be returned.
- delivered=false → no success/delivery claim.
- provider/error path → no false success claim.
- existing consent/handoff trigger behaviour must not regress.

**Execution path**
ChatGPT + GitHub branch → tests/build → Vercel Preview → review/approval → production.

Cursor/local is not expected to be necessary for this task unless runtime debugging reveals something Preview cannot diagnose.

## 12. Rules for each meaningful development task

Before coding, answer:

1. What does current code do?
2. What does TBD-AAS require?
3. What does the Digital Stallion Client Specification require?
4. What do the latest approved client sources say is true?
5. What is the smallest safe change that advances the current Concept/phase?

Avoid giant changes. Preserve working behaviour. Separate Digital Stallion-specific data from reusable Think Big Digital engineering.

## 13. How to update this register

Update this file whenever a meaningful task/phase is completed or a decision changes the next step.

At minimum update:

- Last updated date.
- latest relevant commit/PR/deployment.
- completed work.
- testing result.
- new known issues/decisions.
- exact NEXT TASK.

Do not turn this into a full activity diary. Keep it as the current development checkpoint.

## 14. Resume instruction for a new ChatGPT chat

Use this instruction:

> Read the Project Instructions and first consult "00 - READ FIRST - Digital Stallion AI Sales Assistant - Admin and Knowledge Development Concept v1.1" in Project Sources. Then read `docs/CONTINUITY-REGISTER.md` and inspect current GitHub `main` to verify the register is still accurate. Do not repeat completed audits or rebuild working functionality. Report any register/code conflict. Continue from the task marked **NEXT TASK**, using GitHub → Vercel Preview → review/approval → production.
