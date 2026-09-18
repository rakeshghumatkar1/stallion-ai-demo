/**
 * Apply migrations. Creates the pgvector extension FIRST because the kb_chunks
 * embedding column depends on it (the generated 0000 migration also includes
 * the CREATE EXTENSION line, so plain `drizzle-kit migrate` works too).
 *
 * Run with: npm run db:migrate   (needs DATABASE_URL)
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const sql = postgres(url, { max: 1, prepare: false });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log("[migrate] migrations applied.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
