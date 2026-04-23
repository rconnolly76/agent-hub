"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { severityDot, severityMonoClass } from "./run-detail-tokens";
import { useCommandCenter } from "./command-center-context";

function Kbd({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center rounded font-mono text-[10px] font-medium text-zinc-200/80 px-1.5 py-0.5 border border-white/10 bg-white/[0.06]">
      {k}
    </kbd>
  );
}

function CommandPaletteInner({
  closePalette,
  findings,
  setSelectedId,
}: {
  closePalette: () => void;
  findings: ReturnType<typeof useCommandCenter>["findings"];
  setSelectedId: ReturnType<typeof useCommandCenter>["setSelectedId"];
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const lower = q.toLowerCase();
  const filtered = findings.filter(
    (f) => f.title.toLowerCase().includes(lower) || f.id.toLowerCase().includes(lower),
  );

  return (
    <div
      className="fixed inset-0 z-[9997] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[120px]"
      onClick={closePalette}
    >
      <div
        className="flex w-full max-w-[560px] max-h-[460px] flex-col overflow-hidden rounded-[10px] border border-white/10 bg-[#111] shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-3.5 py-3">
          <Search className="h-4 w-4 text-zinc-400/80" strokeWidth={1.75} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a finding…"
            className="flex-1 bg-transparent text-[14px] text-zinc-50 outline-none placeholder:text-zinc-500"
          />
          <Kbd k="Esc" />
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
          {filtered.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setSelectedId(f.id);
                closePalette();
              }}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-left hover:bg-white/[0.05]"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", severityDot(f.severity))} />
              <span
                className={cn(
                  "font-mono text-[10px] font-bold min-w-[22px]",
                  severityMonoClass(f.severity),
                )}
              >
                {f.id.slice(0, 6)}
              </span>
              <span className="flex-1 truncate text-zinc-100/90">{f.title}</span>
              {f.category && (
                <span className="shrink-0 text-[10px] text-zinc-500/80">{f.category}</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-[12px] text-zinc-500/80">
              No findings match &quot;{q}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CommandPalette() {
  const { paletteOpen, closePalette, findings, setSelectedId } = useCommandCenter();
  if (!paletteOpen) return null;
  return (
    <CommandPaletteInner
      key="open"
      closePalette={closePalette}
      findings={findings}
      setSelectedId={setSelectedId}
    />
  );
}
