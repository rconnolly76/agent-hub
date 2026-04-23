"use client";

import { LinearGlyph } from "./LinearGlyph";
import { useCommandCenter } from "./command-center-context";

export function LinearToast() {
  const { toast } = useCommandCenter();
  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className="fixed right-5 top-[58px] z-[9999] flex animate-[toast-in_180ms_ease-out_both] items-center gap-2.5 rounded-lg border border-[rgba(94,106,210,0.4)] bg-[rgba(17,17,17,0.95)] px-3.5 py-2.5 text-[12.5px] text-zinc-50 shadow-[0_16px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(94,106,210,0.15)] backdrop-blur-md"
    >
      <span className="text-[#a5afff]">
        <LinearGlyph size={14} />
      </span>
      <span>{toast.msg}</span>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
