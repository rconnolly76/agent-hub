"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface Screenshot {
  id: string;
  filename: string;
  blobUrl: string;
}

export function ScreenshotGallery({
  screenshots,
}: {
  screenshots: Screenshot[];
}) {
  const [selected, setSelected] = useState<Screenshot | null>(null);

  const sorted = [...screenshots].sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true })
  );

  const selectedIdx = selected
    ? sorted.findIndex((s) => s.id === selected.id)
    : -1;

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (selectedIdx < 0) return;
      const next = selectedIdx + dir;
      if (next >= 0 && next < sorted.length) setSelected(sorted[next]);
    },
    [selectedIdx, sorted],
  );

  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "ArrowLeft") navigate(-1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, navigate]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sorted.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-foreground/20 transition-colors bg-muted"
          >
            <Image
              src={s.blobUrl}
              alt={s.filename}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 50vw, 33vw"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2">
              <span className="text-[10px] text-white/80 font-mono truncate block">
                {s.filename}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot: ${selected.filename}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selected.blobUrl}
              alt={selected.filename}
              width={1440}
              height={900}
              className="w-full h-auto rounded-lg"
            />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded">
              <span className="text-xs text-white font-mono">
                {selected.filename}
              </span>
              <span className="text-xs text-white/50 ml-2">
                {selectedIdx + 1} / {sorted.length}
              </span>
            </div>
            {selectedIdx > 0 && (
              <button
                onClick={() => navigate(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                ‹
              </button>
            )}
            {selectedIdx < sorted.length - 1 && (
              <button
                onClick={() => navigate(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                ›
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </>
  );
}
