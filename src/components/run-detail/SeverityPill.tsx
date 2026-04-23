import { cn } from "@/lib/utils";
import { severityPillClass } from "./run-detail-tokens";

const LABELS: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  investigate: "Investigate",
  info: "Info",
  low: "Low",
};

interface SeverityPillProps {
  severity: string;
  size?: "sm" | "md";
  className?: string;
}

export function SeverityPill({
  severity,
  size = "sm",
  className,
}: SeverityPillProps) {
  const s = severity.toLowerCase();
  const label = LABELS[s] ?? s;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide",
        size === "sm" ? "gap-1 px-1.5 py-0.5 text-[10px]" : "gap-1.5 px-2.5 py-1 text-xs",
        severityPillClass(s),
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          size === "sm" ? "h-1 w-1" : "h-1.5 w-1.5",
          "bg-[var(--sev-dot,red-400)]",
        )}
      />
      {label}
    </span>
  );
}
