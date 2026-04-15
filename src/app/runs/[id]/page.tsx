import { db } from "@/lib/db";
import { artifacts, metrics, findings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MarkdownReport } from "@/components/MarkdownReport";
import { MarkdownSummary } from "@/components/MarkdownSummary";
import { MetricsSidebar } from "@/components/MetricsSidebar";
import { ScreenshotGallery } from "@/components/ScreenshotGallery";
import { ContentBundleViewer } from "@/components/ContentBundleViewer";
import type { ContentBundleManifest } from "@/lib/parsers/content-bundle";
import type { Metadata } from "next";
import {
  buildRunDetailContractFromBundleManifest,
  buildRunDetailContractFromReport,
  parseRunDetailContract,
} from "@/lib/run-detail-contract";

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractReportSections(
  markdown: string,
  excludeSections: string[] = [],
): { title: string; slug: string }[] {
  const excludes = new Set(excludeSections.map((s) => s.toLowerCase()));
  return markdown
    .split("\n")
    .map((line) => line.match(/^##\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => match[1].replace(/[*_`~\[\]]/g, "").trim())
    .filter((title) => !excludes.has(title.toLowerCase()))
    .map((title) => ({ title, slug: slugify(title) }));
}

function formatArtifactType(artifactType: string): string {
  return artifactType
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, "0");
  return `${weekday}, ${month} ${day}, ${year} at ${h}:${m} ${ampm}`;
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
  const contentArtifacts = runArtifacts.filter((a) => a.role === "content");

  const rawMeta = run.rawMetadata as {
    artifactType?: string;
    manifest?: ContentBundleManifest;
    runDetailContract?: unknown;
  } | null;
  const isContentBundle =
    rawMeta?.artifactType === "content-bundle" && rawMeta.manifest;

  let reportContent = "";
  if (reportArtifact) {
    const res = await fetch(reportArtifact.blobUrl);
    if (res.ok) {
      reportContent = await res.text();
    }
  }

  const contentFileData: { filename: string; blobUrl: string; content: string }[] = [];
  if (isContentBundle && contentArtifacts.length > 0) {
    const fetches = contentArtifacts.map(async (a) => {
      try {
        const res = await fetch(a.blobUrl);
        if (res.ok) {
          const text = await res.text();
          return { filename: a.filename, blobUrl: a.blobUrl, content: text };
        }
      } catch {}
      return { filename: a.filename, blobUrl: a.blobUrl, content: "" };
    });
    contentFileData.push(...(await Promise.all(fetches)));
  }

  const screenshotUrls: Record<string, string> = {};
  for (const s of screenshots) {
    screenshotUrls[s.filename] = s.blobUrl;
  }

  const artifactType = rawMeta?.artifactType ?? "report";
  const artifactTypeLabel = formatArtifactType(artifactType);
  const reportSections = reportContent
    ? extractReportSections(reportContent, ["Executive Summary"])
    : [];
  const contractFromMetadata = parseRunDetailContract(
    rawMeta?.runDetailContract ?? null
  );
  const derivedContractFromReport =
    !contractFromMetadata && reportContent
      ? buildRunDetailContractFromReport({
          markdown: reportContent,
          artifactKind: isContentBundle ? "content-bundle" : "report",
          findings: runFindings,
        })
      : null;
  const derivedContractFromManifest =
    !contractFromMetadata &&
    !derivedContractFromReport &&
    isContentBundle &&
    rawMeta?.manifest
      ? buildRunDetailContractFromBundleManifest(rawMeta.manifest)
      : null;
  const effectiveRunDetailContract =
    contractFromMetadata ?? derivedContractFromReport ?? derivedContractFromManifest;

  const statusTone =
    run.status === "completed"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : run.status === "failed"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-amber-500/10 text-amber-600 border-amber-500/20";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card/40 px-5 py-5 md:px-6">
        <Link
          href={`/projects/${run.project.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group uppercase tracking-wider"
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
          Projects / {run.project.name}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
              {formatSkillType(run.skillType)} Run
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {formatDate(run.createdAt)}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${statusTone}`}
          >
            {run.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Artifact Type</p>
            <p className="font-medium text-foreground mt-0.5">{artifactTypeLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Skill</p>
            <p className="font-medium text-foreground mt-0.5">{formatSkillType(run.skillType)}</p>
          </div>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Findings</p>
            <p className="font-medium text-foreground mt-0.5">{runFindings.length}</p>
          </div>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Metrics</p>
            <p className="font-medium text-foreground mt-0.5">{runMetrics.length}</p>
          </div>
          <div className="rounded-md border border-border bg-background/60 px-3 py-2">
            <p className="text-muted-foreground">Artifacts</p>
            <p className="font-medium text-foreground mt-0.5">{runArtifacts.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-6">
        <aside className="hidden xl:block">
          <div className="sticky top-[calc(4rem+2.5rem+1px)] rounded-lg border border-border bg-card/40 p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              On This Page
            </p>
            <nav className="space-y-1.5 text-sm">
              {run.executiveSummary && (
                <a href="#summary" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Executive Summary
                </a>
              )}
              {isContentBundle && contentFileData.length > 0 && (
                <a href="#content-bundle" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Content Bundle
                </a>
              )}
              {reportContent &&
                !(isContentBundle && reportArtifact?.filename === "bundle-overview.md") && (
                <>
                  <a href="#report" className="block text-muted-foreground hover:text-foreground transition-colors">
                    Report
                  </a>
                  {reportSections.length > 0 && (
                    <div className="pl-3 border-l border-border space-y-1 pt-1">
                      {reportSections.map((section) => (
                        <a
                          key={section.slug}
                          href={`#${section.slug}`}
                          className="block text-xs text-muted-foreground/90 hover:text-foreground transition-colors"
                        >
                          {section.title}
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
              {screenshots.length > 0 && (
                <a href="#screenshots" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Screenshots
                </a>
              )}
              <a href="#metrics" className="block text-muted-foreground hover:text-foreground transition-colors">
                Metrics & Findings
              </a>
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {run.executiveSummary && (
            <section id="summary" className="rounded-lg border border-border bg-card/40 px-6 py-5">
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Executive Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
                <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                  <p className="text-muted-foreground">Run Date</p>
                  <p className="font-medium text-foreground mt-0.5">{formatDate(run.createdAt)}</p>
                </div>
                <div className="rounded-md border border-border bg-background/60 px-3 py-2">
                  <p className="text-muted-foreground">Artifact Type</p>
                  <p className="font-medium text-foreground mt-0.5">{artifactTypeLabel}</p>
                </div>
              </div>
              <MarkdownSummary content={run.executiveSummary} />
            </section>
          )}

          {isContentBundle &&
            rawMeta.manifest &&
            contentFileData.length > 0 && (
              <section id="content-bundle">
                <ContentBundleViewer
                  manifest={rawMeta.manifest}
                  contentFiles={contentFileData}
                />
              </section>
            )}

          {reportContent && !(isContentBundle && reportArtifact?.filename === "bundle-overview.md") ? (
            <section id="report" className={isContentBundle ? "pt-2" : ""}>
              <MarkdownReport
                content={reportContent}
                screenshotUrls={screenshotUrls}
                excludeSections={["Executive Summary"]}
                showTableOfContents={false}
              />
            </section>
          ) : !isContentBundle && !reportContent ? (
            <p className="text-muted-foreground">No report content available</p>
          ) : null}

          {screenshots.length > 0 && (
            <section id="screenshots">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Screenshots</h2>
              <ScreenshotGallery screenshots={screenshots} />
            </section>
          )}
        </div>

        <aside id="metrics" className="xl:order-last">
          <div className="xl:sticky xl:top-[calc(4rem+2.5rem+1px)]">
            <MetricsSidebar
              metrics={runMetrics}
              findings={runFindings}
              skillType={run.skillType}
              runDetailContract={effectiveRunDetailContract}
              linkSections={Boolean(reportContent)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
