import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { compareSuitesDetailed } from "@/lib/suites";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUITE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; suiteRunId: string }> }
) {
  const { id: projectId, suiteRunId } = await ctx.params;
  if (!UUID.test(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }
  if (!SUITE_UUID.test(suiteRunId)) {
    return NextResponse.json({ error: "Invalid suiteRunId" }, { status: 400 });
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const mode = req.nextUrl.searchParams.get("to") ?? "previous";
  const compareMode = mode === "previous" ? "previous" : mode;

  const result = await compareSuitesDetailed(
    projectId,
    suiteRunId.toLowerCase(),
    compareMode
  );

  if (!result.current) {
    return NextResponse.json({ error: "Suite not found" }, { status: 404 });
  }

  return NextResponse.json({
    currentSuiteRunId: result.current.suiteRunId,
    previousSuiteRunId: result.previous?.suiteRunId ?? null,
    findingsDeltaBySkill: result.findingsDeltaBySkill,
    criticalDeltaBySkill: result.criticalDeltaBySkill,
    warningDeltaBySkill: result.warningDeltaBySkill,
    categoryShiftBySkill: result.categoryShiftBySkill,
  });
}
