/**
 * Database client (server-only).
 *
 * postgres.js + Drizzle. The connection is created lazily on first use so the
 * app can be built/typechecked without DATABASE_URL present. Scripts (migrate)
 * create their own short-lived connections; the seed script reuses this client
 * and calls closeDb() when done.
 */
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Cached on globalThis so Next's dev hot-reload doesn't open a new pool on
// every module re-evaluation.
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __db?: Db;
};

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure it.",
    );
  }
  // `prepare: false` keeps us compatible with transaction-mode poolers (Neon).
  const sql = globalForDb.__sql ?? postgres(url, { max: 10, prepare: false });
  globalForDb.__sql = sql;
  const instance = drizzle(sql, { schema });
  globalForDb.__db = instance;
  return instance;
}

/**
 * Lazily-initialized Drizzle client. Import `{ db }` and use it directly; the
 * underlying connection is only opened the first time a query runs.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = globalForDb.__db ?? createDb();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

/** Close the pool (scripts only — the app never needs this). */
export async function closeDb(): Promise<void> {
  await globalForDb.__sql?.end();
  globalForDb.__sql = undefined;
  globalForDb.__db = undefined;
}

export { schema };
