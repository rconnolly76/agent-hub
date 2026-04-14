import { db } from "@/lib/db";
import { runs, metrics, findings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

interface RunWithStats {
  id: string;
  skillType: string;
  status: string;
  executiveSummary: string | null;
  createdAt: Date;
  metrics: { key: string; value: number; unit: string | null }[];
  findingsCount: number;
}

function formatSkillType(type: string): string {
  return type
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSeverityBadge(run: RunWithStats) {
  const critical = run.metrics.find((m) => m.key === "severity_critical");
  const warning = run.metrics.find((m) => m.key === "severity_warning");

  if (critical && critical.value > 0) {
    return (
      <Badge variant="destructive">{critical.value} critical</Badge>
    );
  }
  if (warning && warning.value > 0) {
    return (
      <Badge className="bg-amber-600 text-white hover:bg-amber-700">
        {warning.value} warnings
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
      Healthy
    </Badge>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!project) return notFound();

  const projectRuns = await db.query.runs.findMany({
    where: eq(runs.projectId, id),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const runsWithStats: RunWithStats[] = [];

  for (const run of projectRuns) {
    const runMetrics = await db
      .select()
      .from(metrics)
      .where(eq(metrics.runId, run.id));

    const runFindings = await db
      .select({ count: sql<number>`count(*)` })
      .from(findings)
      .where(eq(findings.runId, run.id));

    runsWithStats.push({
      id: run.id,
      skillType: run.skillType,
      status: run.status,
      executiveSummary: run.executiveSummary,
      createdAt: run.createdAt,
      metrics: runMetrics,
      findingsCount: Number(runFindings[0]?.count ?? 0),
    });
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; All projects
        </Link>
        <div className="flex items-center justify-between mt-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {project.repoUrl && (
              <p className="text-sm text-muted-foreground mt-1">
                {project.repoUrl}
              </p>
            )}
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>API Key</div>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {project.apiKey.slice(0, 8)}...
            </code>
          </div>
        </div>
      </div>

      <Separator className="mb-8" />

      {runsWithStats.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No runs yet for this project</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">
            Run History ({runsWithStats.length})
          </h2>
          {runsWithStats.map((run) => {
            const stepsCompleted = run.metrics.find(
              (m) => m.key === "steps_completed"
            );
            const stepsTotal = run.metrics.find(
              (m) => m.key === "steps_total"
            );
            const heuristic = run.metrics.find(
              (m) => m.key === "heuristic_coverage"
            );

            return (
              <Link key={run.id} href={`/runs/${run.id}`}>
                <Card className="hover:border-foreground/20 transition-colors cursor-pointer mb-4">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {formatSkillType(run.skillType)}
                        </Badge>
                        {getSeverityBadge(run)}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {run.createdAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {run.executiveSummary && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {run.executiveSummary.replace(/\*\*/g, "").slice(0, 250)}
                        {run.executiveSummary.length > 250 ? "..." : ""}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {stepsCompleted && stepsTotal && (
                        <span>
                          Steps: {stepsCompleted.value}/{stepsTotal.value}
                        </span>
                      )}
                      {heuristic && (
                        <span>Heuristic coverage: {heuristic.value}%</span>
                      )}
                      {run.findingsCount > 0 && (
                        <span>{run.findingsCount} findings</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
