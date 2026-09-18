<!--
  BEHAVIOUR PROMPT SLOT — File 04 of the knowledge package goes here.

  How this file is used (see lib/ai/system-prompt.ts → loadBehaviourPrompt):
  - HTML comments like this one are stripped. If nothing else remains, the
    inline behaviour rules in system-prompt.ts are used (the current state).
  - Once real content is pasted below, it REPLACES the inline behaviour
    sections (identity, tone, hard rule, knowledge rules, answer states,
    may-do / must-not-control lists, no-invention, claims-not-authorization,
    input safety, categories, visitor types, escalation, lead capture).
  - The app-owned sections are ALWAYS appended after it and cannot be
    overridden from here: TOOL EFFICIENCY, ANSWER STATE PROTOCOL (the
    [[state:...]] marker), THIS EVENT (identity + contact from config) and
    the CONTEXT block (retrieved, approved knowledge with HISTORICAL labels).
  - No code change is needed. Restart the server after editing.

  Keep the exact fallback wording from File 01 §4 in the pasted prompt:
  "I don't have confirmed information about that in the current event
  information. I can help pass the question to the team."
-->
