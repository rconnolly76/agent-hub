"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CC_ACCENT,
  kanbanColumnForSeverity,
  severityDot,
  severityMonoClass,
} from "./run-detail-tokens";
import { useFindingHash } from "./use-finding-hash";

export interface KanbanFindingRow {
  id: string;
  severity: string;
  title: string;
  category: string | null;
}

interface RunFindingsKanbanProps {
  findings: KanbanFindingRow[];
  /** Verdict strip; reference order: title row → verdict → board */
  verdict?: ReactNode;
}

const COL_LABEL: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  mixed: "Investigate",
  low: "Low",
};

export function RunFindingsKanban({
  findings: rows,
  verdict,
}: RunFindingsKanbanProps) {
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const { selectedId, select } = useFindingHash(ids);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of rows) {
      set.add(f.category?.trim() || "uncategorized");
    }
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const [cat, setCat] = useState("all");

  const filtered = useMemo(() => {
    if (cat === "all") return rows;
    return rows.filter(
      (f) => (f.category?.trim() || "uncategorized") === cat,
    );
  }, [rows, cat]);

  const columns = useMemo(() => {
    const map: Record<string, KanbanFindingRow[]> = {
      critical: [],
      warning: [],
      mixed: [],
      low: [],
    };
    for (const f of filtered) {
      const col = kanbanColumnForSeverity(f.severity);
      map[col].push(f);
    }
    return map;
  }, [filtered]);

  return (
    <div id="findings-triage" className="space-y-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 mb-3.5">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-[-0.3px] text-zinc-100 m-0">
            Triage board
          </h1>
          <p className="text-xs text-zinc-500/90 mt-0.5">
            {filtered.length} findings
            {cat !== "all" ? ` · ${cat}` : ""} · select to inspect
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-[5px] border px-2.5 py-1 text-[11px] font-medium transition-colors inline-flex items-center gap-1.5",
                c === cat
                  ? "border-white/[0.15] bg-white/[0.08] text-zinc-100"
                  : "border-white/[0.08] text-zinc-400/90 hover:text-zinc-200 hover:border-white/15",
              )}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-[5px] border border-white/10 py-1 px-2.5 text-[11px] text-zinc-400/90"
            title="Filter by severity (visual)"
          >
            <span className="text-[9px] font-mono" aria-hidden>
              ≡
            </span>
            Sort
          </button>
        </div>
      </div>

      {verdict}

      {verdict ? <div className="h-4" /> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-h-[200px]">
        {(["critical", "warning", "mixed", "low"] as const).map((key) => {
          const items = columns[key] ?? [];
          const label = COL_LABEL[key];
          return (
            <div
              key={key}
              className="p-2.5 rounded-[9px] border border-white/[0.06] bg-white/[0.02] flex flex-col min-h-[240px] xl:min-h-[300px]"
            >
              <div className="flex items-center gap-2 pb-2.5 mb-2.5 border-b border-white/[0.05]">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    key === "critical"
                      ? cn(severityDot("critical"), "shadow-[0_0_8px_rgba(239,68,68,0.5)]")
                      : key === "warning"
                        ? cn(severityDot("warning"), "shadow-[0_0_8px_rgba(245,158,11,0.45)]")
                        : key === "mixed"
                          ? cn(
                              severityDot("investigate"),
                              "shadow-[0_0_8px_rgba(167,139,250,0.45)]",
                            )
                          : cn(severityDot("low"), "shadow-[0_0_4px_rgba(156,163,175,0.35)]"),
                  )}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-zinc-200/90">
                  {label}
                </span>
                <span className="text-[11px] text-zinc-500/90 tabular-nums">
                  {items.length}
                </span>
                <span className="ms-auto text-zinc-500/50">
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                </span>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {items.map((f) => {
                  const active = f.id === selectedId;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => select(f.id)}
                      className={cn(
                        "text-left rounded-[7px] border p-2.5 text-sm transition-colors",
                        active
                          ? cn(
                              "bg-white/[0.06] border-violet-500/90",
                              CC_ACCENT.ring,
                            )
                          : "border-white/[0.06] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={cn(
                            "text-[10px] font-mono font-semibold tabular-nums",
                            severityMonoClass(f.severity),
                          )}
                        >
                          {f.id.slice(0, 8)}
                        </span>
                        {f.category && (
                          <span className="text-[9.5px] text-zinc-500/80 truncate">
                            {f.category}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium leading-[1.4] text-zinc-100/90">
                        {f.title}
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-white/[0.06] text-[11px] text-zinc-500/50 py-8 px-1">
                    No issues
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
