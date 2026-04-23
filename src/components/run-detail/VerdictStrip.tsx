import Link from "next/link";
import { Check, TriangleAlert, X } from "lucide-react";
import { SeverityPill } from "./SeverityPill";
import type { RunSeverity } from "./run-detail-tokens";

export interface VerdictStats {
  passed?: number;
  warnings?: number;
  failed?: number;
  heuristicPct?: number | null;
}

interface VerdictStripProps {
  headline: string;
  worstSeverity: string | null;
  /** When no summary, omit link target or use #summary only if summary exists */
  linkToSummary: boolean;
  readMoreText?: string;
  stats?: VerdictStats;
}

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "pass" | "warn" | "fail" | "neutral";
}) {
  const valueColor =
    tone === "pass"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "fail"
          ? "text-red-400"
          : "text-zinc-50";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      {icon && <span className={valueColor}>{icon}</span>}
      <span className="text-zinc-400/80">{label}</span>
      <span className={`tabular-nums font-semibold ${valueColor}`}>{value}</span>
    </span>
  );
}

export function VerdictStrip({
  headline,
  worstSeverity,
  linkToSummary,
  readMoreText = "Read full summary",
  stats,
}: VerdictStripProps) {
  const showStats =
    stats &&
    (stats.passed != null ||
      stats.warnings != null ||
      stats.failed != null ||
      stats.heuristicPct != null);

  return (
    <div className="rounded-[9px] border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {worstSeverity && (
        <SeverityPill severity={worstSeverity as RunSeverity} size="md" />
      )}
      <p className="text-[12.5px] text-zinc-200/90 flex-1 min-w-[12rem] leading-[1.45]">
        {headline}
      </p>
      {showStats && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
          {stats!.passed != null && (
            <StatPill
              icon={<Check className="h-3 w-3" strokeWidth={2.25} />}
              label="Passed"
              value={stats!.passed}
              tone="pass"
            />
          )}
          {stats!.warnings != null && (
            <StatPill
              icon={<TriangleAlert className="h-3 w-3" strokeWidth={2} />}
              label="Warn"
              value={stats!.warnings}
              tone="warn"
            />
          )}
          {stats!.failed != null && (
            <StatPill
              icon={<X className="h-3 w-3" strokeWidth={2.25} />}
              label="Failed"
              value={stats!.failed}
              tone="fail"
            />
          )}
          {stats!.heuristicPct != null && (
            <StatPill label="Heuristic" value={`${stats!.heuristicPct}%`} />
          )}
        </div>
      )}
      {linkToSummary && (
        <Link
          href="#summary"
          className="text-[11px] font-medium text-violet-400 hover:text-violet-300 hover:underline shrink-0 inline-flex items-center gap-1"
        >
          {readMoreText}
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
