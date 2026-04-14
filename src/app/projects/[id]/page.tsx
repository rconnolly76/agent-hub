import { db } from "@/lib/db";
import { runs, metrics, findings } from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
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
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return { title: "Not Found" };
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });
  return { title: project?.name ?? "Project" };
}

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
      <Badge className="bg-red-500/15 text-red-400 border-red-500/25">
        {critical.value} critical
      </Badge>
    );
  }
  if (warning && warning.value > 0) {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">
        {warning.value} warnings
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
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

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return notFound();

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  if (!project) return notFound();

  const projectRuns = await db.query.runs.findMany({
    where: eq(runs.projectId, id),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const runIds = projectRuns.map((r) => r.id);

  const [allMetrics, allFindings] =
    runIds.length > 0
      ? await Promise.all([
          db.select().from(metrics).where(inArray(metrics.runId, runIds)),
          db
            .select({
              runId: findings.runId,
              count: sql<number>`count(*)`.as("count"),
            })
            .from(findings)
            .where(inArray(findings.runId, runIds))
            .groupBy(findings.runId),
        ])
      : [[], []];

  const metricsByRun = new Map<string, typeof allMetrics>();
  for (const m of allMetrics) {
    const existing = metricsByRun.get(m.runId) ?? [];
    existing.push(m);
    metricsByRun.set(m.runId, existing);
  }
  const findingsByRun = new Map<string, number>();
  for (const f of allFindings) {
    findingsByRun.set(f.runId, Number(f.count));
  }

  const runsWithStats: RunWithStats[] = projectRuns.map((run) => ({
    id: run.id,
    skillType: run.skillType,
    status: run.status,
    executiveSummary: run.executiveSummary,
    createdAt: run.createdAt,
    metrics: metricsByRun.get(run.id) ?? [],
    findingsCount: findingsByRun.get(run.id) ?? 0,
  }));

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform group-hover:-translate-x-0.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          All projects
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
            <div className="text-4xl mb-4 text-muted-foreground/30">📊</div>
            <p className="text-muted-foreground mb-2">
              No runs yet for this project
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Push your first skill run using the CLI. Your API key is shown
              above.
            </p>
            <code className="block text-xs bg-muted px-4 py-3 rounded-lg font-mono text-muted-foreground max-w-lg mx-auto text-left">
              node agent-hub-push.mjs --endpoint https://your-hub.vercel.app
              --key {project.apiKey.slice(0, 8)}...
            </code>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">
            Run History ({runsWithStats.length})
          </h2>
          {runsWithStats.map((run, i) => {
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
              <Link key={run.id} href={`/runs/${run.id}`} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
                <Card className="hover:border-foreground/20 hover:bg-card/80 hover:shadow-lg hover:shadow-black/5 transition-all duration-200 cursor-pointer mb-4">
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
