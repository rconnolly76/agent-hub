"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FindingInspector } from "@/components/run-detail/FindingInspector";
import type { StrategyRoadmapRow } from "@/lib/project-strategy-roadmap";
import { cn } from "@/lib/utils";

const HORIZON_STYLE: Record<
  "Now" | "Next" | "Later" | "Gated",
  { dot: string }
> = {
  Now: { dot: "#10b981" },
  Next: { dot: "#60a5fa" },
  Later: { dot: "#a1a1aa" },
  Gated: { dot: "#f59e0b" },
};

const ACCENT = "#8b5cf6";
const HORIZON_KEYS: Array<keyof typeof HORIZON_STYLE> = [
  "Now",
  "Next",
  "Later",
  "Gated",
];

function parseFindingHash(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.slice(1);
  if (!raw.startsWith("finding-")) return null;
  const id = raw.slice("finding-".length);
  return id || null;
}

function ScorePill({ n }: { n: number }) {
  const hue = n >= 4.2 ? "#10b981" : n >= 3.6 ? "#f59e0b" : "#a1a1aa";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontVariantNumeric: "tabular-nums",
        color: hue,
        background: `${hue}18`,
        border: `1px solid ${hue}44`,
        borderRadius: 4,
        padding: "1px 6px",
      }}
    >
      {n.toFixed(1)}
    </span>
  );
}

function EffortChip({ e }: { e: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        color: "rgba(250,250,250,0.7)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "1px 6px",
        borderRadius: 4,
      }}
    >
      {e}
    </span>
  );
}

type HorizonKey = (typeof HORIZON_KEYS)[number];

export function ProjectHorizonsBoard({
  byHorizon,
  allRows,
}: {
  byHorizon: Record<HorizonKey, StrategyRoadmapRow[]>;
  allRows: StrategyRoadmapRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, StrategyRoadmapRow>();
    for (const r of allRows) m.set(r.findingId, r);
    return m;
  }, [allRows]);

  const inspectorData = useMemo(
    () => allRows.map((r) => r.inspector),
    [allRows]
  );

  useEffect(() => {
    const fromHash = parseFindingHash();
    if (fromHash && byId.has(fromHash)) setSelectedId(fromHash);
  }, [byId]);

  useEffect(() => {
    const onHash = () => {
      const id = parseFindingHash();
      if (id && byId.has(id)) setSelectedId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [byId]);

  const select = useCallback((findingId: string) => {
    setSelectedId(findingId);
    if (typeof window === "undefined") return;
    const { pathname, search } = window.location;
    window.history.replaceState(
      null,
      "",
      `${pathname}${search}#finding-${findingId}`
    );
  }, []);

  const selected = selectedId ? byId.get(selectedId) : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-5",
        "lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,360px)] lg:items-stretch",
        "lg:gap-6"
      )}
    >
      <div className="min-w-0 grid grid-cols-1 min-[640px]:grid-cols-2 min-[1200px]:grid-cols-4 gap-3 sm:gap-3">
        {HORIZON_KEYS.map((h) => (
          <HorizonColumn
            key={h}
            horizon={h}
            items={byHorizon[h]}
            selectedId={selectedId}
            onSelect={select}
          />
        ))}
      </div>

      <aside
        className="lg:min-h-[min(420px,60vh)] lg:sticky lg:top-4 lg:self-start"
        style={{ minWidth: 0 }}
      >
        <div
          className="rounded-[10px] border border-white/[0.08] bg-white/[0.02] p-4"
          style={{
            color: "#fafafa",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-3 mb-3">
            <div
              className="text-[10px] font-semibold tracking-[0.7px] text-white/45"
              style={{ textTransform: "uppercase" }}
            >
              Finding detail
            </div>
            {selected ? (
              <Link
                href={`/runs/${selected.runId}#finding-${selected.findingId}`}
                className="inline-flex items-center gap-1 text-[11px] text-violet-300/90 hover:text-violet-200"
              >
                <span>Full run view</span>
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </Link>
            ) : null}
          </div>
          <FindingInspector
            findings={inspectorData}
            selectedFindingId={selectedId}
            noSelectionMessage="Select a card in the board to read the full finding, evidence, and recommendation."
          />
        </div>
      </aside>
    </div>
  );
}

function HorizonColumn({
  horizon,
  items,
  selectedId,
  onSelect,
}: {
  horizon: HorizonKey;
  items: StrategyRoadmapRow[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}) {
  const c = HORIZON_STYLE[horizon];
  return (
    <div className="min-w-0">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2px 10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 99,
              background: c.dot,
              boxShadow: `0 0 8px ${c.dot}66`,
            }}
          />
          <span
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.1 }}
          >
            {horizon}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "rgba(250,250,250,0.45)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {items.length}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "rgba(255,255,255,0.015)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 10,
          padding: 8,
          minHeight: 300,
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "rgba(250,250,250,0.35)",
              textAlign: "center",
              padding: "16px 8px",
            }}
          >
            No items
          </div>
        ) : (
          items.map((r) => (
            <button
              key={r.findingId}
              type="button"
              onClick={() => onSelect(r.findingId)}
              className="cursor-pointer text-left w-full m-0 border-0 bg-transparent p-0 font-inherit"
            >
              <div
                style={{
                  background:
                    selectedId === r.findingId
                      ? "rgba(139,92,246,0.12)"
                      : "rgba(255,255,255,0.025)",
                  border:
                    selectedId === r.findingId
                      ? "1px solid rgba(139,92,246,0.4)"
                      : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 8,
                  padding: "12px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
                className="hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500/50"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {r.itemCode && (
                    <code
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 10,
                        color: ACCENT,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                      }}
                    >
                      {r.itemCode}
                    </code>
                  )}
                  {r.itemCode && (
                    <span
                      style={{ fontSize: 10, color: "rgba(250,250,250,0.4)" }}
                    >
                      ·
                    </span>
                  )}
                  <span
                    style={{ fontSize: 10, color: "rgba(250,250,250,0.55)" }}
                  >
                    {r.skillLabel}
                  </span>
                  <span
                    style={{ marginLeft: "auto", display: "flex", gap: 5 }}
                  >
                    {r.score != null && <ScorePill n={r.score} />}
                    {r.effort && <EffortChip e={r.effort} />}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    letterSpacing: -0.1,
                    lineHeight: 1.3,
                    color: "#fafafa",
                  }}
                >
                  {r.what}
                </div>
                {r.why && r.why !== "—" && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(250,250,250,0.62)",
                      lineHeight: 1.5,
                    }}
                  >
                    {r.why}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 2,
                    fontSize: 11,
                    color: "rgba(250,250,250,0.55)",
                    flexWrap: "wrap",
                  }}
                >
                  {r.who && r.who !== "—" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {r.who}
                    </span>
                  )}
                  {r.linked.length > 0 && (
                    <>
                      {r.who && r.who !== "—" && (
                        <span style={{ opacity: 0.3 }}>·</span>
                      )}
                      <span
                        style={{
                          display: "inline-flex",
                          gap: 4,
                          flexWrap: "wrap",
                        }}
                      >
                        {r.linked.map((l) => (
                          <code
                            key={l}
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 10,
                              padding: "1px 5px",
                              borderRadius: 3,
                              background: "rgba(255,255,255,0.05)",
                              color: "rgba(250,250,250,0.7)",
                            }}
                          >
                            {l}
                          </code>
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
