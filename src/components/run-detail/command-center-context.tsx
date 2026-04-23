"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFindingHash } from "./use-finding-hash";

export interface CCFindingRow {
  id: string;
  severity: string;
  title: string;
  category: string | null;
}

export type LinearStatus = "idle" | "pushing" | "synced";

export interface LinearIssueState {
  status: LinearStatus;
  issueId?: string;
  team?: string;
  project?: string;
}

export interface LinearPushConfig {
  team: string;
  project: string;
  assignee: string;
  linkBack: boolean;
  grouping: "separate" | "parent" | "merged";
}

export interface LinearModalState {
  ids: string[];
  mode: "single" | "batch";
}

export interface ToastState {
  id: number;
  msg: string;
  kind: "success" | "error";
}

interface CommandCenterContextValue {
  findings: CCFindingRow[];
  ids: string[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  multiSelect: Set<string>;
  toggleMulti: (id: string) => void;
  clearMulti: () => void;
  linearState: Record<string, LinearIssueState>;
  pushToLinear: (ids: string[], cfg: LinearPushConfig) => void;
  linearModal: LinearModalState | null;
  openLinearModal: (ids: string[]) => void;
  closeLinearModal: () => void;
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  toast: ToastState | null;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

export function useCommandCenter(): CommandCenterContextValue {
  const ctx = useContext(CommandCenterContext);
  if (!ctx) {
    throw new Error("useCommandCenter must be used inside CommandCenterProvider");
  }
  return ctx;
}

/** Safe variant: returns null when no provider is mounted (non-triage routes). */
export function useCommandCenterOptional(): CommandCenterContextValue | null {
  return useContext(CommandCenterContext);
}

export function CommandCenterProvider({
  findings,
  children,
}: {
  findings: CCFindingRow[];
  children: ReactNode;
}) {
  const ids = useMemo(() => findings.map((f) => f.id), [findings]);
  const { selectedId, select } = useFindingHash(ids);

  const [multiSelect, setMultiSelect] = useState<Set<string>>(() => new Set());
  const [linearState, setLinearState] = useState<Record<string, LinearIssueState>>({});
  const [linearModal, setLinearModal] = useState<LinearModalState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const setSelectedId = useCallback(
    (id: string) => {
      select(id);
    },
    [select],
  );

  const toggleMulti = useCallback((id: string) => {
    setMultiSelect((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearMulti = useCallback(() => setMultiSelect(new Set()), []);

  const showToast = useCallback((msg: string, kind: ToastState["kind"] = "success") => {
    const id = Date.now();
    setToast({ id, msg, kind });
    window.setTimeout(() => {
      setToast((curr) => (curr && curr.id === id ? null : curr));
    }, 2800);
  }, []);

  const pushToLinear = useCallback(
    (targetIds: string[], cfg: LinearPushConfig) => {
      if (targetIds.length === 0) return;
      // Stub: mark each pushing then synced on staggered timeouts.
      setLinearState((prev) => {
        const next = { ...prev };
        for (const id of targetIds) next[id] = { status: "pushing" };
        return next;
      });
      targetIds.forEach((id, i) => {
        window.setTimeout(
          () => {
            const num = Math.floor(Math.random() * 900) + 100;
            setLinearState((prev) => ({
              ...prev,
              [id]: {
                status: "synced",
                issueId: `${cfg.team}-${num}`,
                team: cfg.team,
                project: cfg.project,
              },
            }));
            if (i === targetIds.length - 1) {
              showToast(
                targetIds.length > 1
                  ? `${targetIds.length} issues created in Linear`
                  : `Created ${cfg.team}-${num} in Linear`,
              );
              setLinearModal(null);
              setMultiSelect(new Set());
            }
          },
          300 + i * 150,
        );
      });
    },
    [showToast],
  );

  const openLinearModal = useCallback((targetIds: string[]) => {
    if (targetIds.length === 0) return;
    setLinearModal({
      ids: targetIds,
      mode: targetIds.length > 1 ? "batch" : "single",
    });
  }, []);
  const closeLinearModal = useCallback(() => setLinearModal(null), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Keyboard nav: J/K (arrows), X, L, E, ⌘K, Esc.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (linearModal || paletteOpen) {
        if (e.key === "Escape") {
          setLinearModal(null);
          setPaletteOpen(false);
        }
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return;
      }

      if (ids.length === 0) return;
      const idx = selectedId ? ids.indexOf(selectedId) : -1;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = ids[Math.min(ids.length - 1, Math.max(0, idx + 1))];
        if (next) setSelectedId(next);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = ids[Math.max(0, idx - 1)];
        if (next) setSelectedId(next);
      } else if (e.key === "x" || e.key === "X") {
        if (!selectedId) return;
        e.preventDefault();
        toggleMulti(selectedId);
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        const targets = multiSelect.size > 0 ? Array.from(multiSelect) : selectedId ? [selectedId] : [];
        if (targets.length > 0) openLinearModal(targets);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        document
          .getElementById("inspector-evidence")
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        if (multiSelect.size > 0) setMultiSelect(new Set());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ids, selectedId, multiSelect, linearModal, paletteOpen, openLinearModal, setSelectedId, toggleMulti]);

  const value = useMemo<CommandCenterContextValue>(
    () => ({
      findings,
      ids,
      selectedId,
      setSelectedId,
      multiSelect,
      toggleMulti,
      clearMulti,
      linearState,
      pushToLinear,
      linearModal,
      openLinearModal,
      closeLinearModal,
      paletteOpen,
      openPalette,
      closePalette,
      toast,
    }),
    [
      findings,
      ids,
      selectedId,
      setSelectedId,
      multiSelect,
      toggleMulti,
      clearMulti,
      linearState,
      pushToLinear,
      linearModal,
      openLinearModal,
      closeLinearModal,
      paletteOpen,
      openPalette,
      closePalette,
      toast,
    ],
  );

  return (
    <CommandCenterContext.Provider value={value}>
      {children}
    </CommandCenterContext.Provider>
  );
}
