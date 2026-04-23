"use client";

import { LinearGlyph } from "./LinearGlyph";
import { useCommandCenter } from "./command-center-context";

export function LinearSyncBlock() {
  const { findings, linearState } = useCommandCenter();
  if (findings.length === 0) return null;

  const synced = Object.values(linearState).filter((v) => v?.status === "synced").length;
  const pct = findings.length > 0 ? (synced / findings.length) * 100 : 0;

  return (
    <div className="mx-2.5 mb-2.5 rounded-[7px] border border-[rgba(94,106,210,0.25)] bg-[rgba(94,106,210,0.08)] p-2.5">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] text-zinc-50">
        <span className="text-[#a5afff]">
          <LinearGlyph size={13} />
        </span>
        <span className="font-medium">Linear</span>
        <span className="ms-auto text-[10px] text-zinc-400/80">
          {synced === 0 ? "not synced" : synced === findings.length ? "all synced" : "partial"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-sm bg-white/[0.08]">
          <div
            className="h-full bg-gradient-to-r from-[#5e6ad2] to-[#8b5cf6] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-zinc-200/80">
          {synced}/{findings.length}
        </span>
      </div>
    </div>
  );
}
