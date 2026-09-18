# content/editions/UAE-2026 — File 03 goes here

1. Copy `config.example.json` to `config.json` and fill in organiser-approved
   values. Unknown values stay `null` (the assistant then says "not confirmed").
2. Add edition-specific knowledge as `*.md` files with front matter
   (`source_type: edition_config`). Website-derived text must use
   `source_type: website`; it is loaded as provisional/historical.
3. Set `"status": "open"` and mark documents `approval_status: approved` only
   after organiser review (File 01 §10).
4. `npm run content:load -- --event UAE-2026`, then run the File 05 question
   suites (`npm run questions`).

Commit `config.json` once it is the organiser-approved edition configuration;
until then keep it local so unapproved values are never treated as current.
