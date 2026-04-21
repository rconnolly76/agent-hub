import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  findingsSeverityByRun,
  listSuiteSnapshots,
} from "@/lib/suites";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await ctx.params;
  if (!UUID.test(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const snapshots = await listSuiteSnapshots(projectId);
  const enriched = await Promise.all(
    snapshots.map(async (s) => {
      const ids = s.runs.map((r) => r.id);
      const sev = await findingsSeverityByRun(ids);
      let totalFindings = 0;
      let critical = 0;
      let warning = 0;
      for (const rid of ids) {
        for (const row of sev.get(rid) ?? []) {
          totalFindings += row.count;
          if (row.severity === "critical") critical += row.count;
          if (row.severity === "warning") warning += row.count;
        }
      }
      return {
        suiteRunId: s.suiteRunId,
        suiteCompletedAt: s.suiteCompletedAt.toISOString(),
        commitSha: s.commitSha,
        version: s.version,
        runs: s.runs.map((r) => ({
          id: r.id,
          skillType: r.skillType,
          createdAt: r.createdAt.toISOString(),
        })),
        rollup: { totalFindings, critical, warning },
      };
    })
  );

  return NextResponse.json({ suites: enriched });
}
