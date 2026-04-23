import { db } from "@/lib/db";
import { runs, metrics, findings } from "@/lib/db/schema";
import { sql, inArray } from "drizzle-orm";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listSuiteSnapshots, rollupSuiteFindings } from "@/lib/suites";

export const dynamic = "force-dynamic";

interface ProjectWithStats {
  id: string;
  name: string;
  repoUrl: string | null;
  createdAt: Date;
  /** Present when at least one ingested run used `suiteRunId` (suite batch). */
  latestSuite: {
    suiteRunId: string;
    suiteCompletedAt: Date;
    totalFindings: number;
    critical: number;
    warning: number;
  } | null;
  latestRun: {
    id: string;
    skillType: string;
    createdAt: Date;
    criticalCount: number;
    warningCount: number;
    findingsCount: number;
  } | null;
  runCount: number;
  skillHealth: {
    skillType: string;
    runId: string;
    level: "healthy" | "warning" | "critical" | "unknown";
    score: number;
  }[];
  healthScore: number | null;
}

async function getProjectsWithStats(): Promise<ProjectWithStats[]> {
  const allProjects = await db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  if (allProjects.length === 0) return [];

  const projectIds = allProjects.map((p) => p.id);

  const allRuns = await db.query.runs.findMany({
    where: inArray(runs.projectId, projectIds),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const runsByProject = new Map<string, typeof allRuns>();
  for (const run of allRuns) {
    const existing = runsByProject.get(run.projectId) ?? [];
    existing.push(run);
    runsByProject.set(run.projectId, existing);
  }

  const latestRunIds = allProjects
    .map((p) => runsByProject.get(p.id)?.[0]?.id)
    .filter((id): id is string => !!id);
  const latestRunIdSet = new Set(latestRunIds);

  for (const project of allProjects) {
    const projectRuns = runsByProject.get(project.id) ?? [];
    const seenSkillTypes = new Set<string>();
    for (const run of projectRuns) {
      if (seenSkillTypes.has(run.skillType)) continue;
      seenSkillTypes.add(run.skillType);
      latestRunIdSet.add(run.id);
    }
  }

  const metricRunIds = Array.from(latestRunIdSet);

  let allMetrics: { runId: string; key: string; value: number; unit: string | null }[] = [];
  let allFindings: { runId: string; count: number }[] = [];

  if (metricRunIds.length > 0) {
    const [metricsResult, findingsResult] = await Promise.all([
      db.select().from(metrics).where(inArray(metrics.runId, metricRunIds)),
      db
        .select({
          runId: findings.runId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(findings)
        .where(inArray(findings.runId, metricRunIds))
        .groupBy(findings.runId),
    ]);
    allMetrics = metricsResult;
    allFindings = findingsResult;
  }

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

  const suiteLists = await Promise.all(
    allProjects.map((p) => listSuiteSnapshots(p.id))
  );

  return Promise.all(
    allProjects.map(async (project, projectIndex) => {
    const projectRuns = runsByProject.get(project.id) ?? [];
    let latestRun: ProjectWithStats["latestRun"] = null;

    if (projectRuns.length > 0) {
      const latest = projectRuns[0];
      const runMetrics = metricsByRun.get(latest.id) ?? [];

      latestRun = {
        id: latest.id,
        skillType: latest.skillType,
        createdAt: latest.createdAt,
        criticalCount: runMetrics.find((m) => m.key === "severity_critical")?.value ?? 0,
        warningCount: runMetrics.find((m) => m.key === "severity_warning")?.value ?? 0,
        findingsCount: findingsByRun.get(latest.id) ?? 0,
      };
    }

    const latestBySkill = new Map<string, (typeof projectRuns)[number]>();
    for (const run of projectRuns) {
      if (!latestBySkill.has(run.skillType)) {
        latestBySkill.set(run.skillType, run);
      }
    }

    const skillHealth = Array.from(latestBySkill.values()).map((run) => {
      const runMetrics = metricsByRun.get(run.id) ?? [];
      const critical = runMetrics.find((m) => m.key === "severity_critical")?.value ?? 0;
      const warning = runMetrics.find((m) => m.key === "severity_warning")?.value ?? 0;

      let level: ProjectWithStats["skillHealth"][number]["level"] = "unknown";
      let score = 50;
      if (critical > 0) {
        level = "critical";
        score = 20;
      } else if (warning > 0) {
        level = "warning";
        score = 60;
      } else if (runMetrics.length > 0) {
        level = "healthy";
        score = 100;
      }

      return {
        skillType: run.skillType,
        runId: run.id,
        level,
        score,
      };
    });

    const healthScore =
      skillHealth.length > 0
        ? Math.round(
            skillHealth.reduce((sum, entry) => sum + entry.score, 0) /
              skillHealth.length
          )
        : null;

    const suites = suiteLists[projectIndex] ?? [];
    let latestSuite: ProjectWithStats["latestSuite"] = null;
    if (suites[0]) {
      const roll = await rollupSuiteFindings(suites[0]);
      latestSuite = {
        suiteRunId: suites[0].suiteRunId,
        suiteCompletedAt: suites[0].suiteCompletedAt,
        totalFindings: roll.totalFindings,
        critical: roll.critical,
        warning: roll.warning,
      };
    }

    return {
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      createdAt: project.createdAt,
      latestSuite,
      latestRun,
      runCount: projectRuns.length,
      skillHealth,
      healthScore,
    };
    })
  );
}

function getHealthBadge(project: ProjectWithStats) {
  if (!project.latestRun && !project.latestSuite) {
    return <Badge variant="outline">No runs</Badge>;
  }
  if (project.latestSuite) {
    if (project.latestSuite.critical > 0) {
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/25">
          Suite · {project.latestSuite.critical} critical
        </Badge>
      );
    }
    if (project.latestSuite.warning > 0) {
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">
          Suite · {project.latestSuite.warning} warnings
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
        Suite · healthy
      </Badge>
    );
  }
  if (project.latestRun && project.latestRun.criticalCount > 0) {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/25">
        {project.latestRun.criticalCount} critical
      </Badge>
    );
  }
  if (project.latestRun && project.latestRun.warningCount > 0) {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">
        {project.latestRun.warningCount} warnings
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
      Healthy
    </Badge>
  );
}

function formatSkillType(type: string): string {
  return type
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function skillHealthTone(level: "healthy" | "warning" | "critical" | "unknown"): string {
  switch (level) {
    case "healthy":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-500";
    case "warning":
      return "border-amber-500/25 bg-amber-500/10 text-amber-500";
    case "critical":
      return "border-red-500/25 bg-red-500/10 text-red-500";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

export default async function HomePage() {
  const projects = await getProjectsWithStats();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground mt-2">
          {projects.length} project{projects.length !== 1 ? "s" : ""} with agentic skill outputs
        </p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-2">No projects yet</p>
            <p className="text-sm text-muted-foreground">
              Push your first skill run using the{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                agent-hub-push
              </code>{" "}
              CLI
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <Link key={project.id} href={`/projects/${project.id}`} className={`animate-fade-in-up stagger-${Math.min(i + 1, 6)}`}>
              <Card className="hover:border-foreground/20 hover:bg-card/80 hover:shadow-lg hover:shadow-black/5 transition-all duration-200 cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
                    {getHealthBadge(project)}
                  </div>
                  {project.repoUrl && (
                    <CardDescription className="text-xs truncate">
                      {project.repoUrl}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {project.runCount} run{project.runCount !== 1 ? "s" : ""}
                    </span>
                    {project.latestSuite ? (
                      <span className="flex items-center gap-1.5 text-right">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                          Last suite
                        </span>
                        <span>{timeAgo(project.latestSuite.suiteCompletedAt)}</span>
                      </span>
                    ) : (
                      project.latestRun && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                            {formatSkillType(project.latestRun.skillType)}
                          </span>
                          <span>{timeAgo(project.latestRun.createdAt)}</span>
                        </span>
                      )
                    )}
                  </div>

                  {project.skillHealth.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Skill Health
                        </span>
                        {project.healthScore !== null && (
                          <span className="text-[11px] font-medium text-foreground">
                            Score {project.healthScore}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {project.skillHealth.slice(0, 6).map((entry) => (
                          <div
                            key={entry.runId}
                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${skillHealthTone(entry.level)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                            <span className="truncate">{formatSkillType(entry.skillType)}</span>
                          </div>
                        ))}
                      </div>

                      {project.skillHealth.length > 6 && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          +{project.skillHealth.length - 6} more skills
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
