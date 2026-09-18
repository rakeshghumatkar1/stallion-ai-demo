/**
 * Normal-path tests for the pure helpers. No DB, network, or API keys.
 */
import { describe, expect, it } from "vitest";
import { resolveFacts, SUGGESTION_DISCLAIMER } from "@/lib/ai/tools";
import { chunkText } from "@/lib/kb/ingest";
import { groundingCheck } from "@/lib/ai/guardrails";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { FACT_FIELDS, QUICK_ACTIONS } from "@/lib/types";
import { makeEvent } from "./helpers";

describe("resolveFacts (typed columns → confirmed facts)", () => {
  const event = makeEvent();

  it("returns confirmed date, venue, fee, and tax from the event row", () => {
    const facts = resolveFacts(event, ["event_date", "venue", "fees", "taxes"]);
    const byField = Object.fromEntries(facts.map((f) => [f.field, f]));

    expect(byField.event_date).toMatchObject({ confirmed: true, value: "19 March 2027" });
    expect(byField.venue).toMatchObject({ confirmed: true, value: "Mumbai, India" });
    expect(byField.fees?.confirmed).toBe(true);
    expect(byField.fees?.value).toContain("INR 15,000");
    expect(byField.taxes).toMatchObject({ confirmed: true, value: "GST: 18%" });
  });

  it("returns every field when asked for none in particular", () => {
    const facts = resolveFacts(event, []);
    expect(facts.map((f) => f.field)).toEqual(FACT_FIELDS);
    expect(facts.every((f) => f.confirmed)).toBe(true);
  });

  it("formats the contact from config, never a hardcoded person", () => {
    const [contact] = resolveFacts(event, ["contact"]);
    expect(contact?.value).toContain("team: Digital Stallion Awards Team");
    expect(contact?.value).toContain("email: awards@example.com");
  });
});

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("hello world")).toEqual(["hello world"]);
  });

  it("returns nothing for empty input", () => {
    expect(chunkText("   \n\n ")).toEqual([]);
  });

  it("splits long text on paragraph boundaries with overlap", () => {
    const para = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(8).trim(); // ~460 chars
    const text = [para, para, para, para].join("\n\n");
    const chunks = chunkText(text, { size: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000 + 2); // allow the join
    // Overlap: the tail of chunk N appears at the head of chunk N+1.
    const tail = chunks[0]!.slice(-100);
    expect(chunks[1]!.startsWith(tail)).toBe(true);
  });

  it("hard-splits a single oversized paragraph", () => {
    const text = "x".repeat(2500);
    const chunks = chunkText(text, { size: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
  });
});

describe("suggestion framing", () => {
  it("carries the may-be-relevant disclaimer and defers to the team", () => {
    expect(SUGGESTION_DISCLAIMER).toMatch(/may be relevant/i);
    expect(SUGGESTION_DISCLAIMER).toMatch(/team makes the final call/i);
  });
});

describe("groundingCheck (normal)", () => {
  it("passes when every date/amount in the reply is present in the sources", () => {
    const facts = resolveFacts(makeEvent(), ["event_date", "fees"]);
    const sources = [JSON.stringify(facts)];
    const reply = "The ceremony is on 19 March 2027. The standard fee is INR 15,000 per entry.";
    const result = groundingCheck(reply, sources);
    expect(result.ok).toBe(true);
    expect(result.flags).toEqual([]);
  });
});

describe("system prompt assembly", () => {
  it("includes the event identity, the hard rule, and the context block", () => {
    const prompt = buildSystemPrompt({
      event: makeEvent(),
      context: [{ id: "c1", content: "Entry fees apply per entry.", score: 0.9, scope: "evergreen", documentTitle: "How nominations work" }],
    });
    expect(prompt).toContain("Digital Stallion Awards India 2027");
    expect(prompt).toContain("THE ONE HARD RULE");
    expect(prompt).toContain("Entry fees apply per entry.");
    expect(prompt).toContain("How nominations work");
  });

  it("tells the model to treat a missing context as not confirmed", () => {
    const prompt = buildSystemPrompt({ event: makeEvent(), context: [] });
    expect(prompt).toMatch(/no relevant approved knowledge-base passages/i);
    expect(prompt).toContain("log_unanswered");
  });
});

describe("quick actions", () => {
  it("cover the main visitor paths", () => {
    const labels = QUICK_ACTIONS.map((q) => q.label.toLowerCase());
    expect(labels.some((l) => l.includes("brand"))).toBe(true);
    expect(labels.some((l) => l.includes("agency"))).toBe(true);
    expect(labels.some((l) => l.includes("sponsor"))).toBe(true);
    expect(labels.some((l) => l.includes("team"))).toBe(true);
  });
});
