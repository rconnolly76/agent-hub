"use client";

import { useMemo } from "react";
import { SeverityPill } from "./SeverityPill";
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

export function FindingInspector({ findings }: FindingInspectorProps) {
  const ids = useMemo(() => findings.map((f) => f.id), [findings]);
  const { selectedId } = useFindingHash(ids);

  const f =
    findings.find((x) => x.id === selectedId) ??
    (findings.length > 0 ? findings[0] : null);

  if (!f) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No findings for this run.
      </div>
    );
  }

  const rec = f.recommendation as Record<string, unknown> | null;

  return (
    <div className="space-y-4" id="finding-inspector">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Selected finding
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <SeverityPill severity={f.severity} />
          {f.category && (
            <span className="text-[11px] text-muted-foreground rounded-md border border-border px-2 py-0.5">
              {f.category}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground rounded-md border border-border px-2 py-0.5 capitalize">
            {f.status}
          </span>
        </div>
        <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">
          {f.title}
        </h3>
      </div>

      {f.description && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Description
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {f.description}
          </p>
        </div>
      )}

      {rec && typeof rec === "object" && Object.keys(rec).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Recommendation
          </p>
          <pre className="text-xs text-muted-foreground bg-background/80 rounded-md border border-border p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {JSON.stringify(rec, null, 2)}
          </pre>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground font-mono break-all">
        ID: {f.id}
      </p>
    </div>
  );
}
