"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  kanbanColumnForSeverity,
  severityDot,
  type RunSeverity,
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
}

const COL_LABEL: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  mixed: "Investigate",
  low: "Low",
};

export function RunFindingsKanban({ findings: rows }: RunFindingsKanbanProps) {
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
    <div id="findings-triage" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Triage board</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {filtered.length} findings
            {cat !== "all" ? ` · ${cat}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                c === cat
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-border bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-h-[200px]">
        {(["critical", "warning", "mixed", "low"] as const).map((key) => {
          const items = columns[key] ?? [];
          const label = COL_LABEL[key];
          return (
            <div
              key={key}
              className="rounded-lg border border-border bg-background/30 p-2.5 flex flex-col min-h-[180px]"
            >
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border/80">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    key === "critical"
                      ? severityDot("critical")
                      : key === "warning"
                        ? severityDot("warning")
                        : key === "mixed"
                          ? severityDot("investigate")
                          : severityDot("low"),
                  )}
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/90">
                  {label}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                  {items.length}
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
                        "text-left rounded-md border px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border/80 bg-card/50 hover:border-border hover:bg-card/80",
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {(f.severity as RunSeverity) || "—"}
                      </span>
                      <span className="block mt-0.5 text-foreground leading-snug">
                        {f.title}
                      </span>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <div className="flex-1 flex items-center justify-center rounded-md border border-dashed border-border/60 text-[11px] text-muted-foreground py-6">
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
