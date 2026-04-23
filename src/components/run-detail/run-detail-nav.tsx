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
    <nav className={cn("p-4 space-y-6", className)}>
      {sections.map((sec) => (
        <div key={sec.title}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-2">
            {sec.title}
          </p>
          <ul className="space-y-0.5">
            {sec.items.map((it) => (
              <li key={`${it.href}-${it.label}`}>
                <a
                  href={it.href}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <span className="truncate">{it.label}</span>
                  {it.count != null && (
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
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
