/**
 * Simple admin auth (Phase 1, server-only).
 *
 * Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. A successful login sets a
 * signed, httpOnly cookie (HMAC-SHA256 over `email.expiry`) so nothing secret is
 * stored client-side and nothing needs a DB round-trip. This module is the ONLY
 * place that knows about the cookie format — swap it for Auth.js later without
 * touching pages or actions.
 *
 * TODO(phase-2): migrate to Auth.js; keep the exported function names.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "stallion_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface AdminSession {
  email: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface SessionCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
}

function secret(): string {
  // ADMIN_SESSION_SECRET is preferred; deriving from the password keeps dev
  // setup to two variables while still being unguessable without it.
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!s) {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be set for admin auth.");
  }
  return `stallion-admin-session:${s}`;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Constant-time string comparison (length leak is acceptable here). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Compare submitted credentials with the configured admin credentials. */
export function verifyLogin(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase());
  const passwordOk = safeEqual(password, expectedPassword);
  return emailOk && passwordOk;
}

function cookieOptions(maxAge: number): SessionCookie["options"] {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge,
  };
}

/** Build the signed session cookie for a logged-in admin. */
export function createSessionCookie(email: string): SessionCookie {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${Buffer.from(email).toString("base64url")}.${expiresAt}`;
  return {
    name: SESSION_COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: cookieOptions(SESSION_TTL_SECONDS),
  };
}

/** An expired cookie that clears the session. */
export function clearSessionCookie(): SessionCookie {
  return { name: SESSION_COOKIE, value: "", options: cookieOptions(0) };
}

/** Verify a raw cookie value. Returns null for missing, tampered, or expired. */
export function parseSession(value: string | undefined | null): AdminSession | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [emailB64, expStr, sig] = parts as [string, string, string];
  const payload = `${emailB64}.${expStr}`;
  if (!safeEqual(sig, sign(payload))) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;
  return { email: Buffer.from(emailB64, "base64url").toString("utf8"), expiresAt };
}

/**
 * Read the session from a cookie store (Next's `cookies()` result, or anything
 * with a compatible `get`). Structural typing keeps this module free of Next
 * imports so it stays swappable.
 */
export function getAdminSession(cookieStore: {
  get(name: string): { value: string } | undefined;
}): AdminSession | null {
  return parseSession(cookieStore.get(SESSION_COOKIE)?.value);
}
