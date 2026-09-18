# Content package

The approved knowledge the assistant may use, as files you can review in a
pull request. `npm run content:load` reads this folder and upserts the
database (events, categories, forms, jury, knowledge documents — chunked and
embedded). `scripts/seed.ts` remains the sample fallback for a first run.

```
content/
  evergreen/                 File 02 — Evergreen Core Knowledge (markdown, one topic per file)
  editions/<EVENT_ID>/       File 03 — Edition Configuration
    config.json              every field from File 01 §1B (copy config.example.json)
    *.md                     edition-specific knowledge documents
```

## Markdown front matter

Every `.md` file starts with a front-matter block. All keys are optional except
`title` (falls back to the first `# Heading`, then the file name).

```
---
title: How nominations work
source_type: evergreen        # edition_config | evergreen | meeting_notes | website
provisional: false            # true for website-derived or historical content
approval_status: approved     # draft | approved   (only approved reaches the model)
effective_date: 2026-01-01    # optional, ISO date
expiry_date:                  # optional, ISO date
source: https://example.com/page-or-doc
---
```

`source_type` defaults to `evergreen` in `content/evergreen/` and
`edition_config` in an edition folder. `provisional` defaults to `false`, but
the loader forces it to `true` when `source_type` is `website` — website text
is historical evidence only (File 01 §3) and is shown to the model with a
`[HISTORICAL, not confirmed for the current edition]` label.

## Loading

```bash
npm run content:load                       # evergreen + the ACTIVE_EVENT_ID edition
npm run content:load -- --event UAE-2026   # a specific edition
npm run content:load -- --evergreen-only
```

Documents are matched by `(scope, event, title)`, so editing a file and
re-running updates the same document (and bumps its version). Categories and
forms are matched by name; ones missing from `config.json` are deactivated,
never deleted. The jury list is replaced and stays confidential (no chat tool
reads it).
