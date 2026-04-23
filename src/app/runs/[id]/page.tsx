import { db } from "@/lib/db";
import { artifacts, metrics, findings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
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
  type RunDetailContractV1,
  type RunSectionHealthLevel,
} from "@/lib/run-detail-contract";
import { parseTopRecommendationsPayload } from "@/lib/top-recommendations";
import { getSkillFamilyForRun } from "@/lib/run-skill-family";
import { RunDetailCommandShell } from "@/components/run-detail/RunDetailCommandShell";
import { RunDetailSlimHeader } from "@/components/run-detail/RunDetailSlimHeader";
import { VerdictStrip } from "@/components/run-detail/VerdictStrip";
import { RunSectionNav, type NavSectionDef } from "@/components/run-detail/run-detail-nav";
import { RunFindingsKanban } from "@/components/run-detail/RunFindingsKanban";
import { FindingInspector } from "@/components/run-detail/FindingInspector";
import { RunCoverageSummary } from "@/components/run-detail/RunCoverageSummary";
import { worstSeverity } from "@/components/run-detail/run-detail-tokens";
import { CommandCenterProvider } from "@/components/run-detail/command-center-context";
import { LinearPushModal } from "@/components/run-detail/LinearPushModal";
import { CommandPalette } from "@/components/run-detail/CommandPalette";
import { LinearToast } from "@/components/run-detail/LinearToast";
import { LinearSyncBlock } from "@/components/run-detail/LinearSyncBlock";

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

function firstSentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const m = t.match(/^[^.!?]+[.!?]?/);
  return m ? m[0].trim() : t.slice(0, 200);
}

function countSeverities(rows: { severity: string }[]) {
  let critical = 0;
  let warning = 0;
  let investigate = 0;
  let info = 0;
  let low = 0;
  for (const f of rows) {
    const s = f.severity.toLowerCase();
    if (s === "critical") critical++;
    else if (s === "warning") warning++;
    else if (s === "investigate") investigate++;
    else if (s === "info") info++;
    else low++;
  }
  return { critical, warning, investigate, info, low };
}

function sectionLevelForReportSlug(
  contract: RunDetailContractV1 | null,
  slug: string,
): RunSectionHealthLevel | undefined {
  if (!contract?.sections) return undefined;
  for (const s of contract.sections) {
    if (s.id === slug) return s.level;
    if (slugify(s.title) === slug) return s.level;
  }
  return undefined;
}

function hasCoverageMetrics(
  m: { key: string; value: number; unit: string | null }[],
): boolean {
  return m.some((x) =>
    ["steps_total", "steps_completed", "journeys_total"].includes(x.key),
  );
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
    topRecommendations?: unknown;
    suiteRunId?: string;
    suitePhase?: number;
    skillFamily?: string;
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

  const contentFileData: { filename: string; blobUrl: string; content: string }[] =
    [];
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
    rawMeta?.runDetailContract ?? null,
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
  const topRecommendations =
    parseTopRecommendationsPayload(rawMeta?.topRecommendations ?? null)?.recommendations ??
    [];

  const skillFamily = getSkillFamilyForRun(run.skillType, run.rawMetadata);
  const showFindingsTriage =
    runFindings.length > 0 &&
    (skillFamily === "audit" ||
      skillFamily === "browser" ||
      skillFamily === "discovery");

  const skillLabel = formatSkillType(run.skillType);
  const dateLabel = formatDate(run.createdAt);
  const sevCounts = countSeverities(runFindings);
  const worst = worstSeverity(runFindings);
  const showCoverage = hasCoverageMetrics(runMetrics);

  const verdictHeadline = run.executiveSummary?.trim()
    ? firstSentence(run.executiveSummary)
    : runFindings.length > 0
      ? `Review ${runFindings.length} finding${runFindings.length === 1 ? "" : "s"} below.`
      : `${skillLabel} run completed — review metrics and artifacts below.`;

  const navSections: NavSectionDef[] = [];

  const overview: NavSectionDef["items"] = [];
  if (run.executiveSummary) {
    overview.push({
      key: "ov-summary",
      href: "#summary",
      label: "Executive summary",
    });
  }
  if (topRecommendations.length > 0) {
    overview.push({
      key: "ov-recs",
      href: "#top-recommendations",
      label: "Top recommendations",
    });
  }
  if (overview.length > 0) {
    navSections.push({ title: "Overview", items: overview });
  }

  if (showFindingsTriage) {
    const triageItems: NavSectionDef["items"] = [
      {
        key: "filter-all",
        href: "#findings-triage",
        label: "All findings",
        count: runFindings.length,
        filterKey: "all",
      },
      ...(sevCounts.critical > 0
        ? [
            {
              key: "filter-critical",
              href: "#findings-triage",
              label: "Critical",
              count: sevCounts.critical,
              filterKey: "critical" as const,
              severityDot: "critical" as const,
            },
          ]
        : []),
      ...(sevCounts.warning > 0
        ? [
            {
              key: "filter-warning",
              href: "#findings-triage",
              label: "Warning",
              count: sevCounts.warning,
              filterKey: "warning" as const,
              severityDot: "warning" as const,
            },
          ]
        : []),
      ...(sevCounts.investigate > 0
        ? [
            {
              key: "filter-investigate",
              href: "#findings-triage",
              label: "Investigate",
              count: sevCounts.investigate,
              filterKey: "investigate" as const,
              severityDot: "investigate" as const,
            },
          ]
        : []),
      ...(sevCounts.info + sevCounts.low > 0
        ? [
            {
              key: "filter-info-low",
              href: "#findings-triage",
              label: "Info & low",
              count: sevCounts.info + sevCounts.low,
              filterKey: "info" as const,
              severityDot: "info" as const,
            },
          ]
        : []),
      {
        key: "filter-unpushed",
        href: "#findings-triage",
        label: "Unpushed",
        filterKey: "unpushed" as const,
      },
    ];
    if (triageItems.length > 0) {
      navSections.push({ title: "Filter", items: triageItems });
    }
  }

  const reportItems: NavSectionDef["items"] = [];
  if (
    reportContent &&
    !(isContentBundle && reportArtifact?.filename === "bundle-overview.md")
  ) {
    reportItems.push({ key: "r-full", href: "#report", label: "Full report" });
    for (const s of reportSections) {
      const level = sectionLevelForReportSlug(effectiveRunDetailContract, s.slug);
      reportItems.push({
        key: `r-sec-${s.slug}`,
        href: `#${s.slug}`,
        label: s.title,
        ...(level != null ? { sectionLevel: level } : {}),
      });
    }
  }
  if (showCoverage) {
    reportItems.push({ key: "r-cov", href: "#coverage-steps", label: "Coverage" });
  }
  if (reportItems.length > 0) {
    navSections.push({ title: "Report", items: reportItems });
  }

  const runSection: NavSectionDef["items"] = [];
  if (isContentBundle && contentFileData.length > 0) {
    runSection.push({
      key: "run-bundle",
      href: "#content-bundle",
      label: "Content bundle",
      rowIcon: "file" as const,
    });
  }
  if (screenshots.length > 0) {
    runSection.push({
      key: "run-shots",
      href: "#screenshots",
      label: "Screenshots",
      count: screenshots.length,
      rowIcon: "camera" as const,
    });
  }
  runSection.push({
    key: "run-metrics",
    href: "#metrics",
    label: "Metrics & signals",
    rowIcon: "activity" as const,
  });
  runSection.push({
    key: "run-rerun",
    href: "#",
    label: "Re-run",
    rowIcon: "play" as const,
    interactive: false,
  });
  if (runSection.length > 0) {
    navSections.push({ title: "Run", items: runSection });
  }

  const findingInspectorData = runFindings.map((f) => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    description: f.description,
    category: f.category,
    status: f.status,
    recommendation: f.recommendation,
  }));

  const kanbanFindings = runFindings.map((f) => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    category: f.category,
  }));

  const showVerdictStrip =
    Boolean(run.executiveSummary) || runFindings.length > 0;

  const metricNum = (k: string): number | null => {
    const m = runMetrics.find((x) => x.key === k);
    return m ? m.value : null;
  };
  const stepsPassed = metricNum("steps_passed");
  const stepsWarning = metricNum("steps_warning");
  const stepsFailed = metricNum("steps_failed");
  const heuristicPctRaw =
    metricNum("heuristic_coverage_pct") ?? metricNum("heuristic_coverage");
  const heuristicPct =
    heuristicPctRaw != null
      ? Math.round(heuristicPctRaw > 1 ? heuristicPctRaw : heuristicPctRaw * 100)
      : null;
  const verdictStats = {
    passed: stepsPassed ?? undefined,
    warnings: stepsWarning ?? undefined,
    failed: stepsFailed ?? undefined,
    heuristicPct,
  };

  const verdictElement = showVerdictStrip && (
    <VerdictStrip
      headline={verdictHeadline}
      worstSeverity={worst}
      linkToSummary={Boolean(run.executiveSummary)}
      readMoreText={
        showFindingsTriage ? "Read full verdict" : "Read full summary"
      }
      stats={verdictStats}
    />
  );

  const mainColumn = (
    <div className="px-[18px] sm:px-[22px] py-[18px] space-y-8 text-zinc-200">
      {showFindingsTriage ? (
        <RunFindingsKanban findings={kanbanFindings} verdict={verdictElement} />
      ) : (
        verdictElement
      )}

      <RunCoverageSummary metrics={runMetrics} />

      {run.executiveSummary && (
        <section
          id="summary"
          className="rounded-[9px] border border-white/[0.1] bg-white/[0.02] px-6 py-5"
        >
          <h2 className="text-xs font-medium text-zinc-500/90 uppercase tracking-wider mb-3">
            Executive summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-xs">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <p className="text-zinc-500/90">Run date</p>
              <p className="font-medium text-zinc-200 mt-0.5">{dateLabel}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <p className="text-zinc-500/90">Artifact type</p>
              <p className="font-medium text-zinc-200 mt-0.5">{artifactTypeLabel}</p>
            </div>
          </div>
          <MarkdownSummary content={run.executiveSummary} />
        </section>
      )}

      {topRecommendations.length > 0 && (
        <section
          id="top-recommendations"
          className="rounded-[9px] border border-white/[0.1] bg-white/[0.02] px-6 py-5"
        >
          <h2 className="text-xs font-medium text-zinc-500/90 uppercase tracking-wider mb-3">
            Top recommendations
          </h2>
          <div className="space-y-2">
            {topRecommendations.map((item) => (
              <div
                key={item.priority}
                className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-zinc-100/90">{item.title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500/90 border border-white/10 rounded px-1.5 py-0.5">
                    {item.priority}
                  </span>
                </div>
                <p className="text-sm text-zinc-400/90 mt-1">{item.action}</p>
                {item.rationale && (
                  <p className="text-xs text-zinc-500/80 mt-1.5">{item.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isContentBundle && rawMeta.manifest && contentFileData.length > 0 && (
        <section id="content-bundle">
          <ContentBundleViewer
            manifest={rawMeta.manifest}
            contentFiles={contentFileData}
          />
        </section>
      )}

      {reportContent &&
      !(isContentBundle && reportArtifact?.filename === "bundle-overview.md") ? (
        <section id="report" className={isContentBundle ? "pt-2" : ""}>
          <MarkdownReport
            content={reportContent}
            screenshotUrls={screenshotUrls}
            excludeSections={["Executive Summary"]}
            showTableOfContents={false}
          />
        </section>
      ) : !isContentBundle && !reportContent ? (
        <p className="text-zinc-500/90">No report content available.</p>
      ) : null}

      {screenshots.length > 0 && (
        <section id="screenshots">
          <h2 className="text-sm font-medium text-zinc-500/90 uppercase tracking-wider mb-4">
            Screenshots
          </h2>
          <ScreenshotGallery screenshots={screenshots} />
        </section>
      )}
    </div>
  );

  const metricsAside = (
    <div
      id="metrics"
      className="space-y-5 xl:sticky xl:top-[calc(4rem+1.5rem)]"
    >
      {showFindingsTriage && <FindingInspector findings={findingInspectorData} />}
      <MetricsSidebar
        metrics={runMetrics}
        findings={runFindings}
        skillType={run.skillType}
        runDetailContract={effectiveRunDetailContract}
        linkSections={Boolean(reportContent)}
        skillFamily={skillFamily}
        omitFindingsList={showFindingsTriage}
      />
    </div>
  );

  const navElement = (
    <div className="flex h-full min-h-0 flex-col bg-black">
      {showFindingsTriage && (
        <div className="pt-3">
          <LinearSyncBlock />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <RunSectionNav sections={navSections} />
      </div>
    </div>
  );

  const shell = (
    <div className="rd-cc-surface rounded-lg border border-white/[0.08] overflow-hidden shadow-2xl shadow-black/30">
      <RunDetailSlimHeader
        projectId={run.project.id}
        projectName={run.project.name}
        runId={run.id}
        status={run.status}
        skillLabel={skillLabel}
        dateLabel={dateLabel}
      />
      <RunDetailCommandShell
        nav={navElement}
        main={mainColumn}
        aside={metricsAside}
      />
    </div>
  );

  if (!showFindingsTriage) {
    return <div className="space-y-6 pb-8">{shell}</div>;
  }

  return (
    <CommandCenterProvider findings={kanbanFindings}>
      <div className="space-y-6 pb-8">{shell}</div>
      <LinearPushModal />
      <CommandPalette />
      <LinearToast />
    </CommandCenterProvider>
  );
}
