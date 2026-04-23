import { cn } from "@/lib/utils";

interface RunStatusChipProps {
  status: string;
  className?: string;
}

export function RunStatusChip({ status, className }: RunStatusChipProps) {
  const s = status.toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    completed: {
      label: "Completed",
      cls: "text-emerald-400 bg-emerald-500/12 border-emerald-500/30",
    },
    running: {
      label: "Running",
      cls: "text-amber-400 bg-amber-500/12 border-amber-500/30",
    },
    failed: {
      label: "Failed",
      cls: "text-red-400 bg-red-500/12 border-red-500/30",
    },
  };
  const m = map[s] ?? {
    label: status,
    cls: "text-muted-foreground bg-muted/30 border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize",
        m.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
      {m.label}
    </span>
  );
}
