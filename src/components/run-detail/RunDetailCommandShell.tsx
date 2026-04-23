import { cn } from "@/lib/utils";

interface RunDetailCommandShellProps {
  nav: React.ReactNode;
  main: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}

/** Three-pane command-center layout: nav | main | aside. */
export function RunDetailCommandShell({
  nav,
  main,
  aside,
  className,
}: RunDetailCommandShellProps) {
  return (
    <div className={cn("space-y-0", className)}>
      <div
        className={cn(
          "grid min-h-[min(100vh,920px)] lg:min-h-[calc(100vh-8.25rem)] gap-0 overflow-hidden bg-[#0a0a0a]",
          aside
            ? "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_min(100%,400px)]"
            : "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden lg:flex flex-col border-b border-white/[0.06] lg:border-b-0 lg:border-r bg-[#0a0a0a] min-h-0 overflow-y-auto">
          {nav}
        </aside>
        <div className="lg:hidden border-b border-white/[0.06] bg-[#0a0a0a] p-3">
          {nav}
        </div>
        <main className="min-w-0 min-h-0 overflow-y-auto border-b border-white/[0.06] lg:border-b-0 bg-[#0a0a0a]">
          {main}
        </main>
        {aside ? (
          <aside className="min-h-0 overflow-y-auto border-t border-white/[0.06] lg:border-t-0 lg:border-l border-white/[0.06] bg-[#0a0a0a] px-4 py-4 xl:px-[18px]">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
