import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunDetailContractV1, RunSectionHealth } from "@/lib/run-detail-contract";
import type { SkillFamily } from "@/lib/suite-metadata";

interface Metric {
  key: string;
  value: number;
  unit: string | null;
}

interface Finding {
  id: string;
  severity: string;
  title: string;
  status: string;
}

interface MetricsSidebarProps {
  metrics: Metric[];
  findings: Finding[];
  skillType: string;
  runDetailContract?: RunDetailContractV1 | null;
  linkSections?: boolean;
  /** From catalog / ingest; drives which metric groups render. */
  skillFamily?: SkillFamily | null;
  /** When main column already lists findings (triage), omit duplicate list here. */
  omitFindingsList?: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  steps_completed: "Steps Completed",
  steps_total: "Total Steps",
  steps_passed: "Passed",
  steps_warning: "Warnings",
  steps_failed: "Failed",
  journeys_total: "Journeys",
  severity_critical: "Critical Issues",
  severity_warning: "Warning Issues",
  severity_passing: "Passing",
  heuristic_coverage: "Heuristic Coverage",
  synthesized_findings: "Synthesized Findings",
  recommendations_count: "Recommendations",
};

function MetricRow({ metric }: { metric: Metric }) {
  const label = METRIC_LABELS[metric.key] ?? metric.key.replace(/_/g, " ");

  let valueColor = "text-foreground";
  if (metric.key === "severity_critical" && metric.value > 0)
    valueColor = "text-red-400";
  if (metric.key === "severity_warning" && metric.value > 0)
    valueColor = "text-amber-400";
  if (metric.key === "steps_failed" && metric.value > 0)
    valueColor = "text-red-400";
  if (metric.key === "steps_passed")
    valueColor = "text-emerald-400";
  if (metric.key === "severity_passing")
    valueColor = "text-emerald-400";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium tabular-nums ${valueColor}`}>
        {metric.value}
        {metric.unit ? metric.unit : ""}
      </span>
    </div>
  );
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-amber-400";
    case "info":
      return "text-blue-400";
    case "low":
      return "text-muted-foreground";
    case "investigate":
      return "text-purple-400";
    default:
      return "text-muted-foreground";
  }
}

function severityDot(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-400";
    case "warning":
      return "bg-amber-400";
    case "info":
      return "bg-blue-400";
    case "low":
      return "bg-muted-foreground";
    case "investigate":
      return "bg-purple-400";
    default:
      return "bg-muted-foreground";
  }
}

function levelDot(level: RunSectionHealth["level"]): string {
  switch (level) {
    case "critical":
      return "bg-red-400";
    case "watch":
      return "bg-amber-400";
    case "healthy":
      return "bg-emerald-400";
    default:
      return "bg-blue-400";
  }
}

function levelText(level: RunSectionHealth["level"]): string {
  switch (level) {
    case "critical":
      return "Critical";
    case "watch":
      return "Watch";
    case "healthy":
      return "Healthy";
    default:
      return "Info";
  }
}

function healthCardTitle(family: SkillFamily | null | undefined): string {
  if (family === "content") return "Signals";
  if (family === "discovery") return "Overview";
  return "Health";
}

export function MetricsSidebar({
  metrics,
  findings,
  skillType,
  runDetailContract = null,
  linkSections = true,
  skillFamily = null,
  omitFindingsList = false,
}: MetricsSidebarProps) {
  const healthMetrics = metrics.filter((m) =>
    ["severity_critical", "severity_warning", "severity_passing"].includes(m.key)
  );
  const coverageMetrics = metrics.filter((m) =>
    [
      "steps_completed",
      "steps_total",
      "steps_passed",
      "steps_warning",
      "steps_failed",
      "journeys_total",
      "heuristic_coverage",
    ].includes(m.key)
  );
  const summaryMetrics = metrics.filter((m) =>
    ["synthesized_findings", "recommendations_count"].includes(m.key)
  );

  const showCoverageCard =
    coverageMetrics.length > 0 &&
    (skillFamily === "browser" ||
      skillFamily === "discovery" ||
      skillFamily === null ||
      skillFamily === "audit");

  const showHealthCard = skillFamily !== "content" || healthMetrics.length > 0;

  const sections = runDetailContract?.sections ?? [];
  const sectionHealthCounts = sections.reduce(
    (acc, section) => {
      acc[section.level] += 1;
      return acc;
    },
    { critical: 0, watch: 0, healthy: 0, info: 0 } as Record<
      RunSectionHealth["level"],
      number
    >
  );

  return (
    <div className="space-y-4">
      {showHealthCard && (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {healthCardTitle(skillFamily)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2">
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {skillType}
            </span>
          </div>
          {healthMetrics.length > 0 ? (
          <div className="divide-y divide-border">
            {healthMetrics.map((m) => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">No severity metrics for this run.</p>
          )}
        </CardContent>
      </Card>
      )}

      {sections.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Section Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {sectionHealthCounts.critical} critical
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {sectionHealthCounts.watch} watch
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {sectionHealthCounts.healthy} healthy
              </span>
            </div>
            <div className="space-y-2">
              {sections.map((section) => (
                <section
                  key={section.id}
                  className="block rounded-md border border-border px-2.5 py-2 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${levelDot(section.level)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        {linkSections ? (
                          <a
                            href={`#${section.id}`}
                            className="text-xs text-foreground truncate hover:underline underline-offset-2"
                          >
                            {section.title}
                          </a>
                        ) : (
                          <p className="text-xs text-foreground truncate">
                            {section.title}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {levelText(section.level)}
                        </span>
                      </div>
                      {section.summary && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                          {section.summary}
                        </p>
                      )}
                      {(section.criticalCount ||
                        section.warningCount ||
                        section.findingCount) && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {typeof section.criticalCount === "number" && (
                            <span>{section.criticalCount} critical</span>
                          )}
                          {typeof section.warningCount === "number" && (
                            <span>{section.warningCount} warning</span>
                          )}
                          {typeof section.findingCount === "number" && (
                            <span>{section.findingCount} findings</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showCoverageCard && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {coverageMetrics.map((m) => (
                <MetricRow key={m.key} metric={m} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summaryMetrics.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {summaryMetrics.map((m) => (
                <MetricRow key={m.key} metric={m} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {findings.length > 0 && !omitFindingsList && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Findings ({findings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {findings.map((f) => (
                <div key={f.id} className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${severityDot(f.severity)}`}
                  />
                  <span
                    className={`text-xs leading-snug ${severityColor(f.severity)}`}
                  >
                    {f.title}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
