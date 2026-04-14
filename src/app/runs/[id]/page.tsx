import { db } from "@/lib/db";
import { artifacts, metrics, findings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MarkdownReport } from "@/components/MarkdownReport";
import { MetricsSidebar } from "@/components/MetricsSidebar";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
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
  const run = await db.query.runs.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: { project: true },
  });
  if (!run) return { title: "Run" };
  const skillLabel = run.skillType
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: `${skillLabel} — ${run.project.name}` };
}

function formatSkillType(type: string): string {
  return type
    .replace(/^ux-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return notFound();

  const run = await db.query.runs.findFirst({
    where: (r, { eq }) => eq(r.id, id),
    with: { project: true },
  });

  if (!run) return notFound();

  const runArtifacts = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.runId, id));

  const runMetrics = await db
    .select()
    .from(metrics)
    .where(eq(metrics.runId, id));

  const runFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.runId, id));

  const reportArtifact = runArtifacts.find((a) => a.role === "report");
  const screenshots = runArtifacts.filter((a) => a.role === "screenshot");

  let reportContent = "";
  if (reportArtifact) {
    const res = await fetch(reportArtifact.blobUrl);
    if (res.ok) {
      reportContent = await res.text();
    }
  }

  const screenshotUrls: Record<string, string> = {};
  for (const s of screenshots) {
    screenshotUrls[s.filename] = s.blobUrl;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/projects/${run.project.id}`}
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
          {run.project.name}
        </Link>
        <div className="flex items-center gap-3 mt-3">
          <h1 className="text-2xl font-semibold tracking-tight">Run Detail</h1>
          <Badge variant="outline" className="font-mono text-xs">
            {formatSkillType(run.skillType)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {run.createdAt.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <div className="min-w-0">
          {reportContent ? (
            <MarkdownReport
              content={reportContent}
              screenshotUrls={screenshotUrls}
            />
          ) : (
            <p className="text-muted-foreground">No report content available</p>
          )}

          {screenshots.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Screenshots</h2>
              <ScreenshotGallery screenshots={screenshots} />
            </div>
          )}
        </div>

        <aside className="lg:order-last">
          <div className="lg:sticky lg:top-[calc(3.5rem+2rem+1px)]">
            <MetricsSidebar
              metrics={runMetrics}
              findings={runFindings}
              skillType={run.skillType}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
