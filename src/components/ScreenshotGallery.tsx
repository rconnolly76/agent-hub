"use client";

import { useState } from "react";
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
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <span className="text-[10px] text-white/80 font-mono truncate block">
                {s.filename}
              </span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full">
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
            </div>
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
