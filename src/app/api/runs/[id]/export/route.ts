import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  buildRunExportPayload,
  isValidRunId,
} from "@/lib/api/run-export-payload";

/**
 * Return machine-readable run payload (report text + config JSON + findings/metrics)
 * for the same project as the API key. Inverse of POST /api/runs.
 */
export const maxDuration = 120;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "x-api-key header is required" },
        { status: 401 }
      );
    }

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKey, apiKey))
      .limit(1);
    if (!project) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    const { id: runId } = await ctx.params;
    if (!isValidRunId(runId)) {
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    }

    const payload = await buildRunExportPayload(runId, project.id);
    if (!payload) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/runs/[id]/export]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
