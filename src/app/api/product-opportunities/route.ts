import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, runs } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  buildRunExportPayload,
  isValidRunId,
} from "@/lib/api/run-export-payload";

export const maxDuration = 120;

const SKILL = "product-opportunity-analysis" as const;

/**
 * Product-facing **read** API for the product-opportunity-analysis skill.
 * One request returns the latest (or a pinned) run: report markdown, parsed
 * `opportunities` object, and full `configs` (same shape as GET /api/runs/{id}/export).
 * For generic skill exports, use GET /api/runs?skillType=… + /api/runs/{id}/export.
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const runIdParam = searchParams.get("runId")?.trim() || null;

    let runId: string;
    if (runIdParam) {
      if (!isValidRunId(runIdParam)) {
        return NextResponse.json(
          { error: "runId must be a UUID" },
          { status: 400 }
        );
      }
      const row = await db.query.runs.findFirst({
        where: and(
          eq(runs.id, runIdParam),
          eq(runs.projectId, project.id),
          eq(runs.skillType, SKILL)
        ),
      });
      if (!row) {
        return NextResponse.json(
          {
            error:
              "Run not found, or not a product-opportunity-analysis run for this project",
          },
          { status: 404 }
        );
      }
      runId = row.id;
    } else {
      const row = await db.query.runs.findFirst({
        where: and(
          eq(runs.projectId, project.id),
          eq(runs.skillType, SKILL)
        ),
        orderBy: [desc(runs.createdAt)],
      });
      if (!row) {
        return NextResponse.json(
          { error: `No ${SKILL} run found for this project` },
          { status: 404 }
        );
      }
      runId = row.id;
    }

    const base = await buildRunExportPayload(runId, project.id);
    if (!base) {
      return NextResponse.json(
        { error: "Run export failed" },
        { status: 500 }
      );
    }

    const opportunities = base.configs["opportunities.json"];
    return NextResponse.json({
      ...base,
      opportunities: opportunities !== undefined ? opportunities : null,
      hubPath: `/runs/${runId}`,
    });
  } catch (e) {
    console.error("[GET /api/product-opportunities]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
