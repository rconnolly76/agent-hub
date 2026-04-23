/** Severity styling aligned with design primitives + MetricsSidebar. */

export type RunSeverity =
  | "critical"
  | "warning"
  | "investigate"
  | "info"
  | "low"
  | string;

export const SEVERITY_ORDER: RunSeverity[] = [
  "critical",
  "warning",
  "investigate",
  "info",
  "low",
];

export function severityRank(s: string): number {
  const i = SEVERITY_ORDER.indexOf(s.toLowerCase() as RunSeverity);
  return i === -1 ? 99 : i;
}

export function worstSeverity(findings: { severity: string }[]): RunSeverity | null {
  if (findings.length === 0) return null;
  let best = severityRank(findings[0].severity);
  let label: RunSeverity = findings[0].severity.toLowerCase();
  for (const f of findings) {
    const r = severityRank(f.severity);
    if (r < best) {
      best = r;
      label = f.severity.toLowerCase() as RunSeverity;
    }
  }
  return label;
}

export const severityPillClasses: Record<string, string> = {
  critical:
    "text-red-400 bg-red-500/10 border-red-500/25 [--sev-dot:#ef4444]",
  warning:
    "text-amber-400 bg-amber-500/10 border-amber-500/25 [--sev-dot:#f59e0b]",
  investigate:
    "text-violet-300 bg-violet-500/10 border-violet-500/25 [--sev-dot:#a78bfa]",
  info: "text-blue-400 bg-blue-500/10 border-blue-400/25 [--sev-dot:#60a5fa]",
  low: "text-muted-foreground bg-muted/40 border-border [--sev-dot:#9ca3af]",
};

export function severityPillClass(sev: string): string {
  const k = sev.toLowerCase();
  return severityPillClasses[k] ?? severityPillClasses.low;
}

export const severityDotClass: Record<string, string> = {
  critical: "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
  warning: "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
  investigate: "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.5)]",
  info: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]",
  low: "bg-muted-foreground",
};

export function severityDot(sev: string): string {
  return severityDotClass[sev.toLowerCase()] ?? severityDotClass.low;
}

export const KANBAN_COLUMNS = [
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "mixed", label: "Investigate" },
  { key: "low", label: "Low" },
] as const;

/** Map DB severity to kanban column key. */
export function kanbanColumnForSeverity(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "warning") return "warning";
  if (s === "investigate" || s === "info") return "mixed";
  return "low";
}
