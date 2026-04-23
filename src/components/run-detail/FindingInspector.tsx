"use client";

import { type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeverityPill } from "./SeverityPill";
import { severityMonoClass } from "./run-detail-tokens";
import { useCommandCenterOptional } from "./command-center-context";
import { FindingRecommendationView } from "./finding-recommendation-view";
import { LinearGlyph } from "./LinearGlyph";

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
  const cc = useCommandCenterOptional();
  const selectedId = cc?.selectedId ?? null;

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

  const ls = cc?.linearState[f.id];
  const synced = ls?.status === "synced";

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

      {cc ? (
        synced ? (
          <div className="rounded-md border border-[rgba(94,106,210,0.35)] bg-gradient-to-br from-[rgba(94,106,210,0.15)] to-[rgba(139,92,246,0.08)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[#a5afff]">
                <LinearGlyph size={14} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[12px] font-semibold text-zinc-50">
                  {ls?.issueId}
                </div>
                <div className="text-[10.5px] text-zinc-300/70">
                  {ls?.team} · {ls?.project} · Triage
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-50 hover:bg-white/[0.1]"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
                Open
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => cc.openLinearModal([f.id])}
            disabled={ls?.status === "pushing"}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] px-3 py-2.5 text-[12.5px] font-medium text-white disabled:opacity-60"
          >
            <LinearGlyph size={13} />
            {ls?.status === "pushing" ? "Syncing…" : "Create Linear issue"}
            {ls?.status !== "pushing" && (
              <kbd className="ms-1 inline-flex items-center rounded font-mono text-[10px] font-medium text-white/90 px-1 py-0.5 border border-white/30 bg-white/20">
                L
              </kbd>
            )}
          </button>
        )
      ) : null}

      <div id="inspector-evidence" className="grid grid-cols-2 gap-2.5">
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

      <FindingRecommendationView recommendation={f.recommendation} />
    </div>
  );
}
