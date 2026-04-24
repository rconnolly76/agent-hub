import { db } from "@/lib/db";
import { runs, artifacts, findings, metrics } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type RunExportJson = {
  run: {
    id: string;
    projectId: string;
    skillType: string;
    status: string;
    createdAt: Date;
    executiveSummary: string | null;
    rawMetadata: unknown;
  };
  reportMarkdown: string | null;
  findings: (typeof findings.$inferSelect)[];
  metrics: (typeof metrics.$inferSelect)[];
  configs: Record<string, string | unknown>;
  artifacts: {
    filename: string;
    role: string;
    mimeType: string;
    blobUrl: string;
  }[];
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidRunId(id: string): boolean {
  return UUID.test(id);
}

/**
 * Build the same machine-readable JSON we return from GET /api/runs/{id}/export
 * (after verifying the run belongs to projectId).
 */
export async function buildRunExportPayload(
  runId: string,
  projectId: string
): Promise<RunExportJson | null> {
  if (!isValidRunId(runId)) return null;

  const run = await db.query.runs.findFirst({
    where: and(eq(runs.id, runId), eq(runs.projectId, projectId)),
  });
  if (!run) return null;

  const runArtifacts = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.runId, runId));
  const runFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.runId, runId));
  const runMetrics = await db
    .select()
    .from(metrics)
    .where(eq(metrics.runId, runId));

  const reportArtifact = runArtifacts.find((a) => a.role === "report");
  let reportMarkdown: string | null = null;
  if (reportArtifact) {
    try {
      const res = await fetch(reportArtifact.blobUrl);
      if (res.ok) {
        reportMarkdown = await res.text();
      }
    } catch {
      /* blob fetch failed */
    }
  }

  const configs: Record<string, string | unknown> = {};
  for (const c of runArtifacts.filter((a) => a.role === "config")) {
    try {
      const res = await fetch(c.blobUrl);
      if (!res.ok) continue;
      const text = await res.text();
      try {
        configs[c.filename] = JSON.parse(text) as unknown;
      } catch {
        configs[c.filename] = text;
      }
    } catch {
      /* skip */
    }
  }

  return {
    run: {
      id: run.id,
      projectId: run.projectId,
      skillType: run.skillType,
      status: run.status,
      createdAt: run.createdAt,
      executiveSummary: run.executiveSummary,
      rawMetadata: run.rawMetadata,
    },
    reportMarkdown,
    findings: runFindings,
    metrics: runMetrics,
    configs,
    artifacts: runArtifacts.map((a) => ({
      filename: a.filename,
      role: a.role,
      mimeType: a.mimeType,
      blobUrl: a.blobUrl,
    })),
  };
}
