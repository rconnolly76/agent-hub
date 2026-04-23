interface Metric {
  key: string;
  value: number;
  unit: string | null;
}

interface RunCoverageSummaryProps {
  metrics: Metric[];
}

function getNum(metrics: Metric[], key: string): number | null {
  const m = metrics.find((x) => x.key === key);
  if (!m) return null;
  return m.value;
}

export function RunCoverageSummary({ metrics }: RunCoverageSummaryProps) {
  const total = getNum(metrics, "steps_total");
  const done = getNum(metrics, "steps_completed");
  const passed = getNum(metrics, "steps_passed");
  const failed = getNum(metrics, "steps_failed");
  const warn = getNum(metrics, "steps_warning");
  const journeys = getNum(metrics, "journeys_total");

  if (total == null && done == null && journeys == null) return null;

  const pct =
    total != null && total > 0 && done != null
      ? Math.round((done / total) * 100)
      : null;

  const parts = [
    done != null && total != null ? `${done}/${total} steps` : null,
    journeys != null ? `${journeys} journeys` : null,
  ].filter(Boolean);

  return (
    <div id="coverage-steps" className="mt-6 space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold text-foreground/90">Coverage</h2>
        {parts.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {parts.join(" · ")}
          </span>
        )}
      </div>
      {pct != null && (
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
            <span>Steps completed</span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500/80 rounded-l-full transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          {(passed != null || failed != null || warn != null) && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {passed != null && (
                <span className="text-emerald-400">{passed} passed</span>
              )}
              {failed != null && failed > 0 && (
                <span className="text-red-400 ml-2">{failed} failed</span>
              )}
              {warn != null && warn > 0 && (
                <span className="text-amber-400 ml-2">{warn} warn</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
