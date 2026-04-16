import {
  neon,
  neonConfig,
  type NeonQueryFunction,
} from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Neon SQL over HTTP uses `fetch` with **no default timeout**. A bad/missing
 * `DATABASE_URL`, DNS issues, or a wedged edge can otherwise hang until the
 * Vercel function hits `maxDuration` (~300s) and returns 504.
 *
 * We wrap every Neon HTTP request with a per-invocation timeout (default 25s).
 * Override with `DATABASE_FETCH_TIMEOUT_MS`.
 *
 * Use Neon's **pooled** connection string for serverless (Dashboard → Connect).
 */
const nativeFetch = globalThis.fetch.bind(globalThis);

function combineSignals(
  timeoutMs: number,
  upstream?: AbortSignal | null
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!upstream) return timeoutSignal;
  const anyFn = (
    AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }
  ).any;
  if (typeof anyFn === "function") {
    return anyFn([timeoutSignal, upstream]);
  }
  return timeoutSignal;
}

const defaultTimeoutMs = () => {
  const raw = Number(process.env.DATABASE_FETCH_TIMEOUT_MS ?? 25_000);
  if (!Number.isFinite(raw)) return 25_000;
  return Math.min(Math.max(raw, 3_000), 120_000);
};

neonConfig.fetchFunction = (
  input: RequestInfo | URL,
  init?: RequestInit
): ReturnType<typeof fetch> => {
  const ms = defaultTimeoutMs();
  const signal = combineSignals(ms, init?.signal);
  return nativeFetch(input, { ...init, signal });
};

let cachedDb: NeonHttpDatabase<typeof schema> | undefined;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (cachedDb) return cachedDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your environment variables."
    );
  }

  const sql: NeonQueryFunction<false, false> = neon(url);
  cachedDb = drizzle(sql, { schema });
  return cachedDb;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
