import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projectFindings,
  projects,
  trendEvents,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Project-level rationalized state + recent trend events (reconciled after each ingest).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!UUID.test(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const pf = await db
      .select()
      .from(projectFindings)
      .where(
        and(eq(projectFindings.projectId, id), eq(projectFindings.status, "open"))
      )
      .orderBy(desc(projectFindings.updatedAt));

    const byFacet = {
      health: pf.filter((p) => p.facet === "health"),
      strategy: pf.filter((p) => p.facet === "strategy"),
    };

    const recentTrends = await db
      .select()
      .from(trendEvents)
      .where(eq(trendEvents.projectId, id))
      .orderBy(desc(trendEvents.createdAt))
      .limit(100);

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      openByFacet: {
        health: byFacet.health.length,
        strategy: byFacet.strategy.length,
        total: pf.length,
      },
      projectFindings: pf,
      recentTrends,
    });
  } catch (e) {
    console.error("[GET /api/projects/[id]/state]", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
