import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      // `server-only` is a Next.js build-time guard; outside Next it must be a
      // no-op so pure helpers in server modules can be unit-tested.
      "server-only": resolve(__dirname, "tests/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Tests must never need a live DB, network, or API keys.
    globals: true,
  },
});
