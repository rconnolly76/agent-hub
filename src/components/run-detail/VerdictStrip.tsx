import Link from "next/link";
import { SeverityPill } from "./SeverityPill";
import type { RunSeverity } from "./run-detail-tokens";

interface VerdictStripProps {
  headline: string;
  worstSeverity: string | null;
  /** When no summary, omit link target or use #summary only if summary exists */
  linkToSummary: boolean;
  readMoreText?: string;
}

export function VerdictStrip({
  headline,
  worstSeverity,
  linkToSummary,
  readMoreText = "Read full summary",
}: VerdictStripProps) {
  return (
    <div className="rounded-[9px] border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 flex flex-wrap items-center gap-3.5">
      {worstSeverity && (
        <SeverityPill severity={worstSeverity as RunSeverity} size="md" />
      )}
      <p className="text-[12.5px] text-zinc-200/90 flex-1 min-w-[12rem] leading-[1.45]">
        {headline}
      </p>
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
