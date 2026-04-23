"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Camera, FileStack, Activity, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { severityDot } from "@/components/run-detail/run-detail-tokens";
import type { RunSectionHealthLevel } from "@/lib/run-detail-contract";

const SECTION_LEVEL_DOT: Record<RunSectionHealthLevel, string> = {
  healthy: "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)]",
  watch: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
  critical: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.45)]",
  info: "bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.45)]",
};

export type NavRowIcon = "none" | "camera" | "activity" | "play" | "file";

export type NavSeverityDot = "critical" | "warning" | "investigate" | "info";

export interface NavLinkItem {
  href: string;
  label: string;
  count?: number;
  /** Stable key for list rendering */
  key?: string;
  /** "All findings" — active when #findings-triage or no hash */
  triageAll?: boolean;
  /** Triage sub-rows: never show selected / active */
  triageFilter?: boolean;
  /** Small severity dot (FILTER) */
  severityDot?: NavSeverityDot;
  /** H2 / contract section health (REPORT) */
  sectionLevel?: RunSectionHealthLevel;
  rowIcon?: NavRowIcon;
  /** Non-link row (e.g. Re-run placeholder) */
  interactive?: boolean;
}

export interface NavSectionDef {
  title: string;
  items: NavLinkItem[];
}

interface RunSectionNavProps {
  sections: NavSectionDef[];
  className?: string;
}

function useHash(): string {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("hashchange", onStoreChange);
      return () => window.removeEventListener("hashchange", onStoreChange);
    },
    () => window.location.hash,
    () => "",
  );
}

function rowIsActive(item: NavLinkItem, hash: string): boolean {
  const h = hash || "";
  if (item.triageAll) return h === "" || h === "#findings-triage";
  if (item.triageFilter) return false;
  if (item.interactive === false) return false;
  return h === item.href;
}

const ROW_ICONS: Record<Exclude<NavRowIcon, "none">, LucideIcon> = {
  camera: Camera,
  activity: Activity,
  play: Play,
  file: FileStack,
};

function Dot({
  sev,
  className,
}: {
  sev: NavSeverityDot;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", severityDot(sev), className)}
    />
  );
}

function LevelDot({ level, className }: { level: RunSectionHealthLevel; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", SECTION_LEVEL_DOT[level], className)}
    />
  );
}

function NavRow({
  item,
  active,
  children,
}: {
  item: NavLinkItem;
  active: boolean;
  children: ReactNode;
}) {
  const isStatic = item.interactive === false;
  const className = cn(
    "flex w-full min-h-[32px] items-center gap-2.5 rounded-md px-2 text-[12.5px] leading-tight",
    isStatic
      ? "text-zinc-500/75"
      : "transition-colors",
    !isStatic && active
      ? "bg-[#1E1E1E] text-zinc-50"
      : !isStatic
        ? "text-zinc-200/90 hover:bg-white/[0.04] hover:text-zinc-50"
        : null,
  );

  if (isStatic) {
    return <div className={className}>{children}</div>;
  }
  return (
    <a href={item.href} className={className}>
      {children}
    </a>
  );
}

export function RunSectionNav({ sections, className }: RunSectionNavProps) {
  const hash = useHash();

  return (
    <nav className={cn("flex h-full min-h-0 flex-col gap-5 bg-black py-3 pl-1 pr-2.5", className)}>
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#757575]">
            {sec.title}
          </p>
          <ul className="flex flex-col gap-px">
            {sec.items.map((it) => {
              const active = rowIsActive(it, hash);
              const key = it.key ?? `${it.href}::${it.label}`;
              const Ico =
                it.rowIcon && it.rowIcon !== "none" ? ROW_ICONS[it.rowIcon] : null;
              const hasLeftDot = Boolean(it.severityDot) || it.sectionLevel != null;
              return (
                <li key={key}>
                  <NavRow item={it} active={active}>
                    {it.severityDot ? <Dot sev={it.severityDot} /> : null}
                    {!it.severityDot && it.sectionLevel != null ? (
                      <LevelDot level={it.sectionLevel} />
                    ) : null}
                    {Ico && !hasLeftDot ? (
                      <Ico
                        className="size-3.5 shrink-0 text-zinc-500"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                    ) : null}
                    <span className={cn("min-w-0 flex-1", hasLeftDot && "pl-0.5")}>
                      {it.label}
                    </span>
                    {it.count != null && (
                      <span className="shrink-0 pl-1 text-[11.5px] tabular-nums text-zinc-500">
                        {it.count}
                      </span>
                    )}
                  </NavRow>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
