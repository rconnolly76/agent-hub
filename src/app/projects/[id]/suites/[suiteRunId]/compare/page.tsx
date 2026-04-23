import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { compareSuitesDetailed } from "@/lib/suites";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUITE_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatSkillType(type: string): string {
  return type
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function SuiteComparePage({
  params,
}: {
  params: Promise<{ id: string; suiteRunId: string }>;
}) {
  const { id: projectId, suiteRunId } = await params;
  if (!UUID.test(projectId) || !SUITE_UUID.test(suiteRunId)) notFound();

  const project = await db.query.projects.findFirst({
    where: (p, { eq: eqOp }) => eqOp(p.id, projectId),
  });
  if (!project) notFound();

  const result = await compareSuitesDetailed(
    projectId,
    suiteRunId.toLowerCase(),
    "previous"
  );
  if (!result.current) notFound();

  const skills = new Set([
    ...Object.keys(result.findingsDeltaBySkill),
    ...Object.keys(result.criticalDeltaBySkill),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="space-y-8 max-w-4xl">
      <div>
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          {project.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Compare suites</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Current{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{result.current.suiteRunId}</code>
          {result.previous ? (
            <>
              {" "}
              vs previous{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {result.previous.suiteRunId}
              </code>
            </>
          ) : (
            <span> — no previous suite with matching batch metadata</span>
          )}
        </p>
      </div>

      {!result.previous ? (
        <p className="text-sm text-muted-foreground">
          Ingest at least two suite batches (same project, different{" "}
          <code className="text-xs">suiteRunId</code>) to compare.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card/40 px-5 py-4">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Summary
            </h2>
            <div className="flex flex-wrap gap-3 text-sm">
              {Object.entries(result.findingsDeltaBySkill).some(([, d]) => d !== 0) ? (
                <Badge variant="outline" className="font-mono text-xs">
                  Findings delta per skill (see below)
                </Badge>
              ) : (
                <span className="text-muted-foreground">No net change in finding counts by skill.</span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2 font-medium">Skill</th>
                  <th className="px-4 py-2 font-medium tabular-nums">Δ Findings</th>
                  <th className="px-4 py-2 font-medium tabular-nums">Δ Critical</th>
                  <th className="px-4 py-2 font-medium tabular-nums">Δ Warnings</th>
                </tr>
              </thead>
              <tbody>
                {[...skills].sort().map((skill) => (
                  <tr key={skill} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-mono text-xs">
                      {formatSkillType(skill)}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatDelta(result.findingsDeltaBySkill[skill])}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatDelta(result.criticalDeltaBySkill[skill])}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {formatDelta(result.warningDeltaBySkill[skill])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.keys(result.categoryShiftBySkill).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Category shifts (by skill)
              </h2>
              {Object.entries(result.categoryShiftBySkill).map(([skill, cats]) => (
                <div
                  key={skill}
                  className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm"
                >
                  <p className="font-mono text-xs mb-2">{formatSkillType(skill)}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {Object.entries(cats).map(([cat, delta]) => (
                      <li key={cat}>
                        <span className="text-foreground">{cat}</span>: {delta > 0 ? "+" : ""}
                        {delta}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}

function formatDelta(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : String(n);
}
