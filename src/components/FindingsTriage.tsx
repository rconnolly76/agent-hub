"use client";

import { useMemo, useState } from "react";

interface FindingRow {
  id: string;
  severity: string;
  title: string;
  category: string | null;
}

interface FindingsTriageProps {
  findings: FindingRow[];
}

function severityRank(s: string): number {
  const order = ["critical", "warning", "investigate", "info", "low"];
  const i = order.indexOf(s.toLowerCase());
  return i === -1 ? 99 : i;
}

export function FindingsTriage({ findings }: FindingsTriageProps) {
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      set.add(f.category?.trim() || "uncategorized");
    }
    return ["all", ...Array.from(set).sort()];
  }, [findings]);

  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    const list =
      cat === "all"
        ? findings
        : findings.filter((f) => (f.category?.trim() || "uncategorized") === cat);
    return [...list].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity)
    );
  }, [findings, cat]);

  if (findings.length === 0) return null;

  return (
    <section
      id="findings-triage"
      className="rounded-lg border border-border bg-card/40 px-6 py-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Findings
        </h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Category</span>
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="space-y-2">
        {filtered.map((f) => (
          <li
            key={f.id}
            className="flex items-start gap-2 rounded-md border border-border/80 bg-background/50 px-3 py-2"
          >
            <span
              className={`mt-0.5 text-[10px] font-medium uppercase tracking-wide shrink-0 ${
                f.severity === "critical"
                  ? "text-red-400"
                  : f.severity === "warning"
                    ? "text-amber-400"
                    : "text-muted-foreground"
              }`}
            >
              {f.severity}
            </span>
            <span className="text-sm text-foreground">{f.title}</span>
            {f.category && (
              <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                {f.category}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
