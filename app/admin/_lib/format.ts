/** Small display helpers for the admin (server-side only, pure). */

export function fmtDateTime(d: Date | null | undefined): string {
  return d ? `${d.toISOString().replace("T", " ").slice(0, 16)} UTC` : "—";
}

/** Value for an <input type="datetime-local"> (interpreted as UTC on save). */
export function toDateTimeLocal(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 16) : "";
}

export function pretty(v: unknown): string {
  return v == null ? "" : JSON.stringify(v, null, 2);
}

/** First string value of a search param. */
export function param(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
