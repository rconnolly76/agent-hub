"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LinearGlyph } from "./LinearGlyph";
import { severityDot, severityMonoClass } from "./run-detail-tokens";
import { useCommandCenter } from "./command-center-context";

const LINEAR_TEAMS = ["ENG", "DESIGN", "GROWTH", "QA"] as const;
const LINEAR_PROJECTS = ["UX Debt", "Q2 Polish", "Launch Blockers", "Tech Debt"] as const;
const ASSIGNEES = ["Unassigned", "Mae Chen", "Jordan K.", "Sam Rivera"] as const;

function Kbd({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center rounded font-mono text-[10px] font-medium text-zinc-200/80 px-1.5 py-0.5 border border-white/10 bg-white/[0.06]">
      {k}
    </kbd>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300/80 mb-1.5">
      {children}
    </div>
  );
}

function ModalSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-[7px] text-[12px] text-zinc-100 outline-none focus:border-violet-400/60"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-[#111]">
          {o}
        </option>
      ))}
    </select>
  );
}

export function LinearPushModal() {
  const { linearModal, findings, closeLinearModal, pushToLinear } = useCommandCenter();
  const [team, setTeam] = useState<(typeof LINEAR_TEAMS)[number]>("ENG");
  const [project, setProject] = useState<(typeof LINEAR_PROJECTS)[number]>("UX Debt");
  const [assignee, setAssignee] = useState<(typeof ASSIGNEES)[number]>("Unassigned");
  const [linkBack, setLinkBack] = useState(true);
  const [grouping, setGrouping] = useState<"separate" | "parent" | "merged">("separate");

  useEffect(() => {
    if (!linearModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !(document.activeElement as HTMLElement | null)?.tagName?.match(/INPUT|SELECT|TEXTAREA/))) {
        e.preventDefault();
        pushToLinear(linearModal.ids, { team, project, assignee, linkBack, grouping });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [linearModal, team, project, assignee, linkBack, grouping, pushToLinear]);

  if (!linearModal) return null;
  const items = linearModal.ids
    .map((id) => findings.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-md p-10"
      onClick={closeLinearModal}
    >
      <div
        className="flex w-full max-w-[560px] max-h-[85vh] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#111] shadow-[0_40px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[3px] bg-gradient-to-r from-[#5e6ad2] to-[#8b5cf6]" />
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <span className="text-[#a5afff]">
            <LinearGlyph size={18} />
          </span>
          <h2 className="m-0 text-[16px] font-semibold text-zinc-50">
            {linearModal.mode === "batch"
              ? `Push ${items.length} findings to Linear`
              : "Create Linear issue"}
          </h2>
          <button
            type="button"
            onClick={closeLinearModal}
            className="ms-auto flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.05] text-zinc-100 hover:bg-white/[0.1]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div>
            <ModalLabel>Findings</ModalLabel>
            <div className="flex max-h-[180px] flex-col gap-1.5 overflow-y-auto">
              {items.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.025] px-2.5 py-1.5"
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
                  <span className="flex-1 truncate text-[12px] text-zinc-100/90">{f.title}</span>
                </div>
              ))}
            </div>
          </div>

          {linearModal.mode === "batch" && (
            <div>
              <ModalLabel>Group as</ModalLabel>
              <div className="flex gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] p-0.5">
                {(
                  [
                    { v: "separate", l: "Separate issues" },
                    { v: "parent", l: "One parent + sub-issues" },
                    { v: "merged", l: "Single merged issue" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setGrouping(o.v)}
                    className={cn(
                      "flex-1 rounded px-2.5 py-1.5 text-[11.5px] transition-colors",
                      grouping === o.v
                        ? "bg-violet-500 font-semibold text-white"
                        : "text-zinc-300/80 hover:text-zinc-100",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <ModalLabel>Team</ModalLabel>
              <ModalSelect value={team} onChange={setTeam} options={LINEAR_TEAMS} />
            </div>
            <div>
              <ModalLabel>Project</ModalLabel>
              <ModalSelect value={project} onChange={setProject} options={LINEAR_PROJECTS} />
            </div>
            <div>
              <ModalLabel>Assignee</ModalLabel>
              <ModalSelect value={assignee} onChange={setAssignee} options={ASSIGNEES} />
            </div>
            <div>
              <ModalLabel>Priority</ModalLabel>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-[7px] text-[12px] text-zinc-300/80">
                Auto · mapped from severity
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-zinc-200/80">
            <input
              type="checkbox"
              checked={linkBack}
              onChange={(e) => setLinkBack(e.target.checked)}
              className="accent-violet-500"
            />
            Link back to this run in issue description
          </label>

          <div className="rounded-md border border-dashed border-white/[0.08] bg-white/[0.025] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-zinc-400/80">
            <div className="mb-1 text-zinc-200/80"># Preview</div>
            <div>Title: {items[0]?.title ?? "—"}</div>
            <div>
              Labels: [agent-hub, {items[0]?.severity ?? "—"},{" "}
              {items[0]?.category?.toLowerCase() || "uncategorized"}]
            </div>
            {linkBack && <div>Link: agenthub.dev/runs/{items[0]?.id.slice(0, 8) ?? "—"}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/[0.06] px-5 py-3.5">
          <span className="text-[11px] text-zinc-400/80">
            <Kbd k="Esc" /> cancel · <Kbd k="⏎" /> create
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={closeLinearModal}
            className="rounded-md border border-white/[0.08] px-3.5 py-1.5 text-[12px] text-zinc-200/80 hover:bg-white/[0.04]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              pushToLinear(linearModal.ids, { team, project, assignee, linkBack, grouping })
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-br from-[#5e6ad2] to-[#8b5cf6] px-3.5 py-1.5 text-[12px] font-medium text-white"
          >
            <LinearGlyph size={12} />
            {linearModal.mode === "batch"
              ? `Create ${items.length} issues`
              : "Create issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
