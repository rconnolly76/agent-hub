"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SeverityPill } from "./SeverityPill";
import { severityMonoClass } from "./run-detail-tokens";
import { useFindingHash } from "./use-finding-hash";

export interface FindingInspectorData {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  recommendation: unknown;
}

interface FindingInspectorProps {
  findings: FindingInspectorData[];
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium tracking-[0.05em] uppercase text-zinc-500/90 mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function MetaBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md py-2 px-2.5 border border-white/[0.06] bg-white/[0.025]">
      <div className="text-[9.5px] uppercase tracking-[0.06em] text-zinc-500/80">
        {label}
      </div>
      <div
        className={cn(
          "text-[11.5px] mt-0.5 text-zinc-200/90 break-words",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function FindingInspector({ findings }: FindingInspectorProps) {
  const ids = useMemo(() => findings.map((f) => f.id), [findings]);
  const { selectedId } = useFindingHash(ids);

  const f =
    findings.find((x) => x.id === selectedId) ??
    (findings.length > 0 ? findings[0] : null);

  if (!f) {
    return (
      <div className="rounded-lg border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-zinc-500">
        No findings for this run.
      </div>
    );
  }

  const rec = f.recommendation as Record<string, unknown> | null;
  const recStr =
    rec && typeof rec === "object" && Object.keys(rec).length > 0
      ? JSON.stringify(rec, null, 2)
      : null;

  return (
    <div className="flex flex-col gap-4 text-zinc-100" id="finding-inspector">
      <div className="flex items-center flex-wrap gap-2">
        <span
          className={cn(
            "text-[10px] font-mono font-bold",
            severityMonoClass(f.severity),
          )}
        >
          {f.id.slice(0, 8)}
        </span>
        <SeverityPill severity={f.severity} />
        {f.category && (
          <span className="ms-auto text-[10px] text-zinc-500/90 truncate max-w-[45%]">
            {f.category}
          </span>
        )}
      </div>

      <h3 className="text-[17px] font-semibold tracking-[-0.2px] text-zinc-100 m-0 leading-[1.35]">
        {f.title}
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        <MetaBlock label="Status" value={f.status} />
        <MetaBlock label="Category" value={f.category ?? "—"} />
      </div>

      {f.description && (
        <Block title="Description">
          <p className="m-0 text-[12.5px] leading-[1.6] text-zinc-200/80 whitespace-pre-wrap">
            {f.description}
          </p>
        </Block>
      )}

      {recStr && (
        <Block title="Recommendation">
          <pre className="m-0 text-xs text-zinc-400/90 bg-black/30 rounded-md border border-white/[0.06] p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-48">
            {recStr}
          </pre>
        </Block>
      )}
    </div>
  );
}
