import Link from "next/link";
import { SeverityPill } from "./SeverityPill";
import type { RunSeverity } from "./run-detail-tokens";

interface VerdictStripProps {
  headline: string;
  worstSeverity: string | null;
  /** When no summary, omit link target or use #summary only if summary exists */
  linkToSummary: boolean;
}

export function VerdictStrip({
  headline,
  worstSeverity,
  linkToSummary,
}: VerdictStripProps) {
  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 flex flex-wrap items-center gap-3">
      {worstSeverity && (
        <SeverityPill severity={worstSeverity as RunSeverity} size="md" />
      )}
      <p className="text-sm text-foreground/90 flex-1 min-w-[12rem] leading-snug">
        {headline}
      </p>
      {linkToSummary && (
        <Link
          href="#summary"
          className="text-xs font-medium text-primary hover:underline shrink-0 inline-flex items-center gap-1"
        >
          Read full summary
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
