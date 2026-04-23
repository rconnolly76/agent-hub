import { cn } from "@/lib/utils";

export interface SeverityCounts {
  critical: number;
  warning: number;
  info?: number;
  passing?: number;
}

interface SeveritySummaryBarProps {
  signals: SeverityCounts;
  showLabels?: boolean;
  className?: string;
}

export function SeveritySummaryBar({
  signals,
  showLabels = true,
  className,
}: SeveritySummaryBarProps) {
  const info = signals.info ?? 0;
  const passing = signals.passing ?? 0;

  const rows = [
    { k: "critical" as const, v: signals.critical, dot: "bg-red-400" },
    { k: "warning" as const, v: signals.warning, dot: "bg-amber-400" },
    { k: "info" as const, v: info, dot: "bg-blue-400" },
    { k: "passing" as const, v: passing, dot: "bg-emerald-400" },
  ];

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-sm bg-white/5">
        {rows.map(
          (r) =>
            r.v > 0 && (
              <div
                key={r.k}
                className={cn(r.dot, "opacity-90")}
                style={{ flex: r.v }}
              />
            ),
        )}
      </div>
      {showLabels && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", r.dot)} />
              <span className="font-medium tabular-nums text-foreground/90">
                {r.v}
              </span>
              <span className="capitalize">{r.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
