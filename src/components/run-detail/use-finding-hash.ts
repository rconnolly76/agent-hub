"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const PREFIX = "finding-";

function parseHash(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.slice(1);
  if (!raw.startsWith(PREFIX)) return null;
  const id = raw.slice(PREFIX.length);
  return id || null;
}

function subscribeToHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

/** Sync inspector + board selection with URL hash `#finding-{uuid}`. */
export function useFindingHash(findingIds: string[]) {
  const firstId = findingIds[0] ?? null;

  const fromHash = useSyncExternalStore(
    subscribeToHash,
    () => {
      const h = parseHash();
      if (h && findingIds.includes(h)) return h;
      return null;
    },
    () => null,
  );

  const selectedId = useMemo(() => fromHash ?? firstId, [fromHash, firstId]);

  const select = useCallback((findingId: string) => {
    const next = `#${PREFIX}${findingId}`;
    if (typeof window !== "undefined" && window.location.hash !== next) {
      window.location.hash = next;
    }
  }, []);

  return { selectedId, select };
}
