import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env for drizzle-kit CLI commands (generate/push).
config({ path: ".env" });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
