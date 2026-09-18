# Stallion AI Assistant

A grounded, safe, event-pinned AI concierge for Digital Stallion's award sites
in India and the UAE. The model runs the conversation; the application owns the
facts. See [CLAUDE.md](CLAUDE.md) for the architecture and the safety model,
and [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for the full brief.

## Setup

```bash
npm install --ignore-scripts --no-audit --no-fund
cp .env.example .env
```

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres with pgvector (Neon works out of the box) |
| `OPENAI_API_KEY` | The single provider key: chat model and embeddings |
| `MODEL_ID` | OpenAI chat model, Responses API (default `gpt-5.6-terra`, the balanced tier) |
| `EMBEDDINGS_PROVIDER`, `EMBEDDING_DIM` | Embeddings (`openai`, `text-embedding-3-small`, 1536) |
| `ACTIVE_EVENT_ID` | The ONE event this deployment serves, e.g. `INDIA-2027` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | Admin login |
| `HANDOFF_CHANNEL`, `HANDOFF_EMAIL`, `RESEND_API_KEY` | Team notification on handoff |

Then:

```bash
npm run db:generate   # emit the migration from the schema (offline)
npm run db:migrate    # CREATE EXTENSION vector; then apply migrations
npm run seed          # sample INDIA-2027 event, categories, KB, form
npm run dev           # demo at /, widget at /widget, admin at /admin
```

### Windows / sandbox install note

`npm install` can fail in restricted sandboxes because a native `esbuild`
postinstall tries to spawn `cmd.exe`, and npm then rolls back the whole
install. `--ignore-scripts` avoids that; esbuild's binary still arrives via
its `@esbuild/win32-x64` optional package, so `tsx`, `drizzle-kit`, `vitest`
and `next` all work. Don't pipe `npm install` into `tail`: it masks npm's exit
code.

## Embedding on an award site

```html
<script src="https://<assistant-host>/embed.js" async></script>
```

Optional attributes: `data-color="#4f46e5"`, `data-label="Chat with us"`. The
script injects a launcher and an iframe pointing at `<host>/widget`. Which
event the assistant serves is fixed by the deployment's `ACTIVE_EVENT_ID`; the
page cannot change it.

## Deploying for India and the UAE

Deploy this codebase twice, each with its own database rows and its own
`ACTIVE_EVENT_ID` (`INDIA-2027`, `UAE-2027`). Nothing in a request can select a
different event, so the two deployments cannot leak into each other.

## Verification

```bash
npm run typecheck && npm run lint && npm run db:generate && npm run build && npm run test
```

Tests never need a database, network, or API keys.

## Admin

`/admin` — simple env-based login (Phase 1). Read views for conversations,
leads, handoffs, and unanswered questions; editors for the event's typed fact
fields and the knowledge base (saving re-chunks and re-embeds; only `approved`,
active, in-date documents ever reach the assistant).

## Out of scope for Phase 1

Auto-emailing forms, submission tracking, reminder/confirmation emails,
dashboards, CRM/WhatsApp integration, Arabic, payments, Auth.js migration.
