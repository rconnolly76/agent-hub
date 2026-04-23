import { cn } from "@/lib/utils";

export interface NavLinkItem {
  href: string;
  label: string;
  count?: number;
}

export interface NavSectionDef {
  title: string;
  items: NavLinkItem[];
}

interface RunSectionNavProps {
  sections: NavSectionDef[];
  className?: string;
}

export function RunSectionNav({ sections, className }: RunSectionNavProps) {
  return (
    <nav className={cn("flex flex-col gap-[18px] py-4 px-3", className)}>
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500/90 px-2 mb-1.5">
            {sec.title}
          </p>
          <ul className="flex flex-col gap-px">
            {sec.items.map((it) => (
              <li key={`${it.href}-${it.label}`}>
                <a
                  href={it.href}
                  className="flex items-center justify-between gap-2 rounded-[5px] py-1.5 px-2 text-[12.5px] text-zinc-400/90 hover:text-zinc-100 hover:bg-white/[0.06] transition-colors"
                >
                  <span className="truncate">{it.label}</span>
                  {it.count != null && (
                    <span className="text-[10.5px] tabular-nums text-zinc-500/90 shrink-0">
                      {it.count}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
