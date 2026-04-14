import { db } from "@/lib/db";
import { runs, metrics, findings } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface ProjectWithStats {
  id: string;
  name: string;
  repoUrl: string | null;
  createdAt: Date;
  latestRun: {
    id: string;
    skillType: string;
    createdAt: Date;
    criticalCount: number;
    warningCount: number;
    findingsCount: number;
  } | null;
  runCount: number;
}

async function getProjectsWithStats(): Promise<ProjectWithStats[]> {
  const allProjects = await db.query.projects.findMany({
    orderBy: (p, { desc }) => [desc(p.createdAt)],
  });

  const projectStats: ProjectWithStats[] = [];

  for (const project of allProjects) {
    const projectRuns = await db.query.runs.findMany({
      where: eq(runs.projectId, project.id),
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    let latestRun: ProjectWithStats["latestRun"] = null;

    if (projectRuns.length > 0) {
      const latest = projectRuns[0];

      const criticalMetric = await db
        .select()
        .from(metrics)
        .where(eq(metrics.runId, latest.id))
        .then((m) => m.find((x) => x.key === "severity_critical"));

      const warningMetric = await db
        .select()
        .from(metrics)
        .where(eq(metrics.runId, latest.id))
        .then((m) => m.find((x) => x.key === "severity_warning"));

      const runFindings = await db
        .select({ count: sql<number>`count(*)` })
        .from(findings)
        .where(eq(findings.runId, latest.id));

      latestRun = {
        id: latest.id,
        skillType: latest.skillType,
        createdAt: latest.createdAt,
        criticalCount: criticalMetric?.value ?? 0,
        warningCount: warningMetric?.value ?? 0,
        findingsCount: Number(runFindings[0]?.count ?? 0),
      };
    }

    projectStats.push({
      id: project.id,
      name: project.name,
      repoUrl: project.repoUrl,
      createdAt: project.createdAt,
      latestRun,
      runCount: projectRuns.length,
    });
  }

  return projectStats;
}

function getHealthBadge(project: ProjectWithStats) {
  if (!project.latestRun) {
    return <Badge variant="outline">No runs</Badge>;
  }
  if (project.latestRun.criticalCount > 0) {
    return (
      <Badge variant="destructive">
        {project.latestRun.criticalCount} critical
      </Badge>
    );
  }
  if (project.latestRun.warningCount > 0) {
    return (
      <Badge className="bg-amber-600 text-white hover:bg-amber-700">
        {project.latestRun.warningCount} warnings
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-700">
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

export default async function HomePage() {
  const projects = await getProjectsWithStats();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Agentic skill outputs across all your projects
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
        </div>
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
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:border-foreground/20 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
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
                    {project.latestRun && (
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">
                          {formatSkillType(project.latestRun.skillType)}
                        </span>
                        <span>{timeAgo(project.latestRun.createdAt)}</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
