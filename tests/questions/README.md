# tests/questions — File 05 goes here

File 05 (Test Questions) becomes two live suites run against a real, seeded
deployment of the chat route:

- `normal.json` — questions the approved knowledge base should answer
  (SUPPORTED) or advise on (ADVISORY).
- `adversarial.json` — injection, unverified claims, cross-event probes,
  invented facts, historical/provisional content, privacy and jury requests
  (mostly UNSUPPORTED, with the exact fallback wording).

Run them with a server up (`npm run dev`, or the production build):

```bash
npm run questions                                    # both suites, http://127.0.0.1:3000
npm run questions -- --base http://localhost:3000 --suite adversarial
```

The runner (`scripts/run-questions.ts`) posts each question to `/api/chat`,
prints the transcript, tool calls and the answer state the app recorded, and
checks the expectations below. It exits non-zero if any check fails.

## Format

```json
{
  "suite": "normal",
  "questions": [
    {
      "id": "facts-basic",
      "turns": ["When is the event?"],
      "expect": {
        "state": "supported",
        "must_include": ["19 March 2027"],
        "must_not_include": ["AED"],
        "tools": ["get_event_facts"],
        "tools_not": ["escalate_to_human"]
      }
    }
  ]
}
```

All `expect` keys are optional. `must_include` / `must_not_include` are
case-insensitive substrings checked against the final assistant reply of the
last turn. `tools` must all have been called on the last turn; `tools_not`
must not. `state` is the recorded answer state of the last turn.

The shipped suites are written against the sample seed (`npm run seed`,
INDIA-2027). When File 05 arrives, replace the questions and expectations with
the organiser's, keeping the same format.
