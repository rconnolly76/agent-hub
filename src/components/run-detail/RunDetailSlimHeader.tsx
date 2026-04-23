import Link from "next/link";
import { RunStatusChip } from "./RunStatusChip";

interface RunDetailSlimHeaderProps {
  projectId: string;
  projectName: string;
  runId: string;
  status: string;
  skillLabel: string;
  dateLabel: string;
}

export function RunDetailSlimHeader({
  projectId,
  projectName,
  runId,
  status,
  skillLabel,
  dateLabel,
}: RunDetailSlimHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card/50 px-4 py-3 text-[12px]">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold bg-gradient-to-br from-violet-500 to-blue-500 text-white"
          aria-hidden
        >
          A
        </span>
        <span className="hidden sm:inline">{projectName}</span>
      </Link>
      <span className="text-border">/</span>
      <span className="text-muted-foreground">runs</span>
      <span className="text-border">/</span>
      <code className="font-mono text-foreground/90">{runId.slice(0, 8)}</code>
      <RunStatusChip status={status} />
      <span className="text-muted-foreground hidden md:inline">
        {skillLabel} · {dateLabel}
      </span>
    </header>
  );
}
