/**
 * Runs once per server cold start before other modules handle traffic.
 * Ensures Neon `fetchFunction` / DB wiring is registered before route handlers run.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  await import("@/lib/db");
}
