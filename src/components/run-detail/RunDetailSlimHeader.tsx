"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { RunStatusChip } from "./RunStatusChip";
import { cn } from "@/lib/utils";
import { useCommandCenterOptional } from "./command-center-context";
import { LinearGlyph } from "./LinearGlyph";

interface RunDetailSlimHeaderProps {
  projectId: string;
  projectName: string;
  runId: string;
  status: string;
  skillLabel: string;
  dateLabel: string;
  className?: string;
}

function Kbd({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center rounded font-mono text-[10px] font-medium text-zinc-200/80 px-1.5 py-0.5 border border-white/10 bg-white/[0.06]">
      {k}
    </kbd>
  );
}

export function RunDetailSlimHeader({
  projectId,
  projectName,
  runId,
  status,
  skillLabel,
  dateLabel,
  className,
}: RunDetailSlimHeaderProps) {
  const cc = useCommandCenterOptional();
  const multiCount = cc?.multiSelect.size ?? 0;

  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-white/[0.06] bg-[#0a0a0a] px-[18px] py-2.5 text-[12px] leading-tight",
        className,
      )}
    >
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2.5 text-zinc-500 hover:text-zinc-200 transition-colors"
      >
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[11px] font-bold text-white bg-gradient-to-br from-violet-500 to-violet-600 shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_4px_12px_rgba(139,92,246,0.35)]"
          aria-hidden
        >
          A
        </span>
        <span className="hidden sm:inline text-zinc-200/60">{projectName}</span>
      </Link>
      <span className="text-zinc-700/90">/</span>
      <span className="text-zinc-500/90">runs</span>
      <span className="text-zinc-700/90">/</span>
      <code className="font-mono text-zinc-200">{runId.slice(0, 8)}</code>
      <RunStatusChip status={status} />
      <span className="text-zinc-500/90 hidden md:inline">
        {skillLabel} · {dateLabel}
      </span>

      <div className="ms-auto flex flex-wrap items-center gap-2">
        {cc && multiCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/[0.1] py-1 pl-3 pr-1">
            <span className="text-[11px] text-zinc-50">{multiCount} selected</span>
            <button
              type="button"
              onClick={() => cc.openLinearModal(Array.from(cc.multiSelect))}
              className="inline-flex items-center gap-1 rounded bg-violet-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-violet-400"
            >
              <LinearGlyph size={11} />
              Push to Linear
              <span className="ms-0.5 inline-flex items-center rounded font-mono text-[10px] font-medium text-white/90 px-1 py-px border border-white/30 bg-white/20">
                L
              </span>
            </button>
          </div>
        )}
        {cc && (
          <button
            type="button"
            onClick={cc.openPalette}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300/80 hover:text-zinc-50"
          >
            <Search className="h-3 w-3" strokeWidth={1.75} />
            <span>Jump to…</span>
            <Kbd k="⌘K" />
          </button>
        )}
        <span
          className="hidden xl:flex items-center gap-1.5 text-zinc-500/90 pl-1"
          aria-hidden
        >
          <Kbd k="J" />
          <Kbd k="K" />
          <span className="text-[11px] text-zinc-500/70 pl-0.5">nav</span>
          <span className="text-zinc-700/80 px-1">·</span>
          <Kbd k="X" />
          <span className="text-[11px] text-zinc-500/70">select</span>
          <span className="text-zinc-700/80 px-1">·</span>
          <Kbd k="L" />
          <span className="text-[11px] text-zinc-500/70">Linear</span>
        </span>
      </div>
    </header>
  );
}
