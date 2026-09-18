/**
 * Production-only content loader for Vercel.
 *
 * Preview builds compile the application without touching the production
 * database. On the production deployment, load exactly one UAE event package
 * and no evergreen/India knowledge.
 */
import "dotenv/config";
import { closeDb } from "@/lib/db";
import { loadEdition } from "./load-content";

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log(`[production-content] skipping DB load for VERCEL_ENV=${process.env.VERCEL_ENV ?? "local"}`);
    return;
  }
  console.log("[production-content] loading UAE-GMM-2026-TEST only");
  await loadEdition("UAE-GMM-2026-TEST");
  console.log("[production-content] UAE-only knowledge loaded");
}

main()
  .catch((err) => {
    console.error("[production-content] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
