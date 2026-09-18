/**
 * Knowledge rules (File 01) — answer states, source rules, historical
 * labelling, announcements, and the behaviour-prompt slot. Pure helpers only.
 */
import { describe, expect, it } from "vitest";
import {
  ANSWER_STATE_MARKERS,
  answerStateTransform,
  extractAnswerState,
  inferAnswerState,
} from "@/lib/ai/answer-state";
import { NO_CONFIRMED_INFO } from "@/lib/ai/guardrails";
import {
  buildBehaviourBlock,
  buildSystemPrompt,
  formatContextItem,
  HISTORICAL_LABEL,
} from "@/lib/ai/system-prompt";
import { activeAnnouncements, resolveFacts } from "@/lib/ai/tools";
import { FACT_FIELDS, PRODUCT_IDENTITY_EN } from "@/lib/types";
import { makeEvent } from "./helpers";

const FALLBACK =
  "I don't have confirmed information about that in the current event information. I can help pass the question to the team.";

describe("closed-world fallback wording", () => {
  it("is the exact File 01 §4 sentence", () => {
    expect(NO_CONFIRMED_INFO).toBe(FALLBACK);
  });
});

describe("answer state marker", () => {
  it("is extracted and stripped from the final text", () => {
    const r = extractAnswerState(`The fee is INR 15,000.\n${ANSWER_STATE_MARKERS.supported}\n`);
    expect(r.state).toBe("supported");
    expect(r.text).toBe("The fee is INR 15,000.");
  });

  it("returns null when absent and leaves text untouched", () => {
    const r = extractAnswerState("Hello there.\n");
    expect(r).toEqual({ text: "Hello there.\n", state: null });
  });

  it("is inferred conservatively when the model omits it", () => {
    expect(inferAnswerState(FALLBACK)).toBe("unsupported");
    expect(inferAnswerState("I can't confirm that discount myself.")).toBe("unsupported");
    expect(inferAnswerState("Best Digital Campaign appears potentially relevant because…")).toBe("advisory");
    expect(inferAnswerState("The ceremony is on 19 March 2027.")).toBe("supported");
  });
});

async function runTransform(chunks: string[], stepFinish = true): Promise<{ text: string; states: string[] }> {
  const states: string[] = [];
  const ts = answerStateTransform((s) => states.push(s))();
  const writer = ts.writable.getWriter();
  const reader = ts.readable.getReader();
  const out: string[] = [];
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.type === "text-delta") out.push(value.textDelta);
    }
  })();
  for (const c of chunks) await writer.write({ type: "text-delta", textDelta: c } as never);
  if (stepFinish) await writer.write({ type: "step-finish" } as never);
  await writer.close();
  await pump;
  return { text: out.join(""), states };
}

describe("answerStateTransform (streaming)", () => {
  it("strips a marker split across chunks and reports the state", async () => {
    const r = await runTransform(["The venue is ", "Mumbai.", "\n[[sta", "te:unsup", "ported]]", "\n"]);
    expect(r.text).toBe("The venue is Mumbai.");
    expect(r.states).toEqual(["unsupported"]);
  });

  it("leaves ordinary text, brackets and citations alone", async () => {
    const r = await runTransform(["See [[1]] and [note]", " for details [", "x]."]);
    expect(r.text).toBe("See [[1]] and [note] for details [x].");
    expect(r.states).toEqual([]);
  });

  it("flushes held-back text at the end even without a marker", async () => {
    const r = await runTransform(["Unclosed [[ bracket at end"], false);
    expect(r.text).toBe("Unclosed [[ bracket at end");
  });
});

describe("system prompt encodes File 01", () => {
  const prompt = buildSystemPrompt({ event: makeEvent(), context: [], behaviourOverride: null });

  it("carries the exact fallback wording and the closed-world rule", () => {
    expect(prompt).toContain(FALLBACK);
    expect(prompt).toMatch(/closed-world rule/i);
    expect(prompt).toMatch(/never fill a gap from model memory/i);
  });

  it("defines the three answer states with the required phrasing", () => {
    expect(prompt).toContain("SUPPORTED");
    expect(prompt).toContain("ADVISORY");
    expect(prompt).toContain("UNSUPPORTED");
    expect(prompt).toContain('"appear potentially relevant"');
    expect(prompt).toMatch(/never say a visitor definitely qualifies/i);
  });

  it("lists source priority, the conflict rule, and the website-content rule", () => {
    expect(prompt).toMatch(/\(1\) explicit organiser-approved Edition Configuration/);
    expect(prompt).toMatch(/\(4\) current website text/);
    expect(prompt).toMatch(/If sources conflict, do not choose one by guessing/);
    expect(prompt).toContain(HISTORICAL_LABEL);
  });

  it("includes the may-do and must-not-control lists", () => {
    expect(prompt).toMatch(/What you MAY do: understand natural-language questions/);
    expect(prompt).toMatch(/What you must NOT control: official dates or deadlines/);
    expect(prompt).toMatch(/admin permissions/);
  });

  it("lists every File 01 §8 escalation trigger", () => {
    for (const trigger of [
      "sponsorship or partnership",
      "bulk / high-volume",
      "discount request",
      "deadline extension or exception",
      "material eligibility ambiguity",
      "conflicting information",
      "complaint or dispute",
      "privacy request",
      "speak with a person",
      "not answered by the approved knowledge base",
    ]) {
      expect(prompt.toLowerCase()).toContain(trigger.toLowerCase());
    }
  });

  it("encodes lead capture per §9 and product identity per §12", () => {
    expect(prompt).toMatch(/help first, ask later/i);
    expect(prompt).toMatch(/mobile number ONLY if a callback is requested/);
    expect(prompt).toContain(PRODUCT_IDENTITY_EN.name);
    expect(prompt).toContain(PRODUCT_IDENTITY_EN.subtitle);
    expect(prompt).toContain(PRODUCT_IDENTITY_EN.greeting);
  });

  it("always ends with the answer-state protocol", () => {
    expect(prompt).toContain(ANSWER_STATE_MARKERS.supported);
    expect(prompt).toContain(ANSWER_STATE_MARKERS.unsupported);
  });
});

describe("behaviour prompt slot (File 04)", () => {
  it("replaces the inline behaviour rules but keeps app-owned sections", () => {
    const override = "# FILE 04 RULES\n- Be excellent.";
    const prompt = buildSystemPrompt({ event: makeEvent(), context: [], behaviourOverride: override });
    expect(prompt.startsWith(override)).toBe(true);
    expect(prompt).not.toContain(buildBehaviourBlock().slice(0, 40));
    expect(prompt).toContain("ANSWER STATE PROTOCOL");
    expect(prompt).toContain("TOOL EFFICIENCY");
    expect(prompt).toContain("THIS EVENT");
  });

  it("falls back to the inline rules when the slot file is only comments", () => {
    // behaviourOverride undefined → loads lib/ai/behaviour-prompt.md (comments only)
    const prompt = buildSystemPrompt({ event: makeEvent(), context: [] });
    expect(prompt).toContain("# KNOWLEDGE RULES");
  });
});

describe("provisional context is labelled HISTORICAL", () => {
  it("prefixes provisional chunks and labels the source bucket", () => {
    const item = formatContextItem(
      { id: "c", content: "Nominations closed on 15 November 2025.", score: 0.9, scope: "event", documentTitle: "Old site", sourceType: "website", provisional: true },
      0,
    );
    expect(item.startsWith("[[1] — Old site (source: website)]")).toBe(true);
    expect(item).toContain(`${HISTORICAL_LABEL}\nNominations closed on 15 November 2025.`);
  });

  it("does not label confirmed edition content", () => {
    const item = formatContextItem(
      { id: "c", content: "Deadline 31 January 2027.", score: 0.9, scope: "event", sourceType: "edition_config", provisional: false },
      1,
    );
    expect(item).not.toContain(HISTORICAL_LABEL);
    expect(item).toContain("(source: edition_config)");
  });
});

describe("sponsors and announcements facts", () => {
  const now = new Date("2026-09-18T12:00:00Z");

  it("FACT_FIELDS includes the new fields", () => {
    expect(FACT_FIELDS).toEqual(expect.arrayContaining(["sponsors", "announcements"]));
  });

  it("returns only announcements in date", () => {
    const event = makeEvent();
    expect(activeAnnouncements(event.announcements, now).map((a) => a.text)).toEqual([
      "Early-bird rate applies before 15 December 2026.",
    ]);
    const [fact] = resolveFacts(event, ["announcements"], now);
    expect(fact?.confirmed).toBe(true);
    expect(fact?.value).toContain("15 December 2026");
    expect(fact?.value).not.toContain("Super early-bird");
  });

  it("reports 'none in effect' when everything has expired, and not-confirmed when never configured", () => {
    const later = new Date("2027-06-01T00:00:00Z");
    const [expired] = resolveFacts(makeEvent(), ["announcements"], later);
    expect(expired).toMatchObject({ confirmed: true });
    expect(expired?.value).toMatch(/No announcements/);
    const [unset] = resolveFacts(makeEvent({ announcements: null }), ["announcements"], now);
    expect(unset).toEqual({ field: "announcements", confirmed: false, value: null });
  });

  it("formats sponsors from the typed column", () => {
    const [s] = resolveFacts(makeEvent(), ["sponsors"]);
    expect(s).toMatchObject({ confirmed: true, value: "Sample Sponsor (Gold)" });
  });
});
