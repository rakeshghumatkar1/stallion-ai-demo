/**
 * Guardrails — input handling + output grounding.
 *
 * THE ONE HARD RULE is enforced here alongside the system prompt and the
 * event-scoped tools:
 *  - Visitor text is treated as DATA, never as instructions (wrapped + flagged).
 *  - The output grounding check scans a drafted reply for any date, number, or
 *    currency amount not present in the tool results / retrieved context and
 *    logs a grounding flag. The bar for invented facts is zero.
 *  - When nothing relevant is known, callers use NO_CONFIRMED_INFO.
 *
 * These functions are pure and dependency-free so they are unit-testable without
 * a DB, network, or API key.
 */
import type { GroundingFlag, GroundingResult } from "@/lib/types";

/**
 * The canonical "I don't know yet, let me connect you" pattern. Use this
 * verbatim (or lead with it) whenever retrieval + tools yield nothing relevant,
 * or a requested fact is unconfirmed.
 */
export const NO_CONFIRMED_INFO =
  "I don't have confirmed information on that yet — I can connect you with the team so they can help you directly.";

const MAX_USER_CHARS = 8000;

/** Patterns that indicate an attempt to override instructions or exfiltrate the prompt. */
const INJECTION_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "ignore-instructions", re: /\b(ignore|disregard|forget)\b[^.]*\b(instruction|prompt|rule|guideline)s?\b/i },
  { label: "override-system", re: /\b(system|developer)\s+(prompt|message|instructions?)\b/i },
  { label: "reveal-prompt", re: /\b(reveal|show|print|repeat|output)\b[^.]*\b(prompt|instructions?|system)\b/i },
  { label: "role-override", re: /\b(you are now|act as|pretend (to be|you are)|new persona|jailbreak)\b/i },
  { label: "impersonate-founder", re: /\b(pretend|act|speak|respond)\b[^.]*\bfounder\b/i },
  { label: "authority-claim", re: /\b(as (the )?(admin|administrator|owner|anthropic|system)|i am (the )?(admin|owner|founder))\b/i },
];

export interface InjectionResult {
  injected: boolean;
  matches: string[];
}

/** Detect likely prompt-injection / instruction-override attempts (for logging + posture). */
export function detectPromptInjection(text: string): InjectionResult {
  const matches: string[] = [];
  for (const { label, re } of INJECTION_PATTERNS) {
    if (re.test(text)) matches.push(label);
  }
  return { injected: matches.length > 0, matches };
}

/**
 * Patterns where a visitor asserts a commercial commitment, permission, or
 * exception. These are INPUTS, never authorization: they must be referred to an
 * authorized team member unless the approved system explicitly confirms them.
 */
const CLAIM_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "promised", re: /\b(promised|assured|guaranteed|told us|said we (could|can|get|don'?t))\b/i },
  { label: "discount", re: /\b(\d{1,3}\s?%|percent)\s?(off|discount)|\b(discount|free entr(y|ies)|comp(ed|limentary)|waive[dr]?)\b/i },
  { label: "deadline-extension", re: /\b(deadline|last date)\b[^.]*\b(extend|extended|moved|pushed)\b/i },
  { label: "tax-exemption", re: /\b(no|without|don'?t (need to )?pay|exempt(ed)? from)\b[^.]*\b(vat|gst|tax|taxes)\b/i },
  { label: "founder-approval", re: /\b(founder|paurush)\b[^.]*\b(approved|promised|said|told|confirmed|ok(ayed)?)\b/i },
];

export interface ClaimResult {
  claim: boolean;
  matches: string[];
}

/**
 * Detect unverified commercial/authority claims made by the visitor (e.g.
 * "Paurush promised me 50% off"). Logged and used to steer the reply toward a
 * team referral rather than acceptance.
 */
export function detectUnverifiedClaim(text: string): ClaimResult {
  const matches: string[] = [];
  for (const { label, re } of CLAIM_PATTERNS) {
    if (re.test(text)) matches.push(label);
  }
  return { claim: matches.length > 0, matches };
}

/** Normalize + cap raw visitor input. Never throws. */
export function sanitizeUserText(text: string): string {
  // Strip NUL bytes (they break Postgres text columns), cap length, trim.
  return (text ?? "").toString().replace(/\u0000/g, "").slice(0, MAX_USER_CHARS).trim();
}

/**
 * Wrap visitor content so the model sees it explicitly as untrusted data. The
 * system prompt tells the model that anything inside <visitor_message> is data,
 * not an instruction.
 */
export function wrapUntrustedUserContent(text: string): string {
  return `<visitor_message>\n${sanitizeUserText(text)}\n</visitor_message>`;
}

// ---- Output grounding check -------------------------------------------------

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
}

const MONTHS =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";

/** Extract fact-like tokens (currency, years, dates) from a reply. */
export function extractFactTokens(reply: string): GroundingFlag[] {
  const tokens: GroundingFlag[] = [];
  const seen = new Set<string>();
  const push = (kind: GroundingFlag["kind"], raw: string) => {
    const value = raw.trim();
    const key = `${kind}:${normalizeForMatch(value)}`;
    if (!value || seen.has(key)) return;
    seen.add(key);
    tokens.push({ kind, value, reason: "not found in tool results or retrieved context" });
  };

  // Currency amounts (symbol- or code-adjacent numbers).
  const currency =
    /(?:₹|rs\.?|inr|aed|dhs?|usd|\$|€|£)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:aed|inr|usd|rupees?|dirhams?)/gi;
  for (const m of reply.matchAll(currency)) push("currency", m[0]);

  // 4-digit years.
  for (const m of reply.matchAll(/\b(?:19|20)\d{2}\b/g)) push("number", m[0]);

  // Dates: "12 March", "March 12", "12th of Feb".
  const dateRe = new RegExp(
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}\\b|\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
    "gi",
  );
  for (const m of reply.matchAll(dateRe)) push("date", m[0]);

  return tokens;
}

/**
 * Scan a drafted reply for fact-like tokens (dates/numbers/currency) that do NOT
 * appear in the provided grounding sources. Returns any flags; callers log them
 * (and may regenerate with a stricter instruction).
 */
export function groundingCheck(reply: string, sources: string[]): GroundingResult {
  const haystack = normalizeForMatch(sources.join(" \n "));
  const candidates = extractFactTokens(reply);
  const flags = candidates.filter((c) => {
    const needle = normalizeForMatch(c.value)
      // compare on the numeric/word core so "₹5,000" matches "5000" in sources
      .replace(/[₹$€£]/g, "")
      .replace(/\b(rs|inr|aed|dhs|usd|rupees?|dirhams?)\b/g, "")
      .trim();
    return needle.length > 0 && !haystack.includes(needle);
  });
  return { ok: flags.length === 0, flags };
}
