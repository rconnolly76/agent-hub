import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function MetricsSidebar({
  metrics,
  findings,
  skillType,
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2">
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {skillType}
            </span>
          </div>
          <div className="divide-y divide-border">
            {healthMetrics.map((m) => (
              <MetricRow key={m.key} metric={m} />
            ))}
          </div>
        </CardContent>
      </Card>

      {coverageMetrics.length > 0 && (
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

      {findings.length > 0 && (
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
