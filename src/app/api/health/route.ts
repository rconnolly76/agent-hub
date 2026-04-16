import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Lightweight DB connectivity check. Use after deploy or when ingest returns 5xx/504.
 */
export const maxDuration = 30;

export async function GET() {
  const started = Date.now();
  try {
    await db.execute(sql`select 1 as ok`);
    return NextResponse.json({
      ok: true,
      db: "up",
      latencyMs: Date.now() - started,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, db: "error", error: message, latencyMs: Date.now() - started },
      { status: 503 }
    );
  }
}
