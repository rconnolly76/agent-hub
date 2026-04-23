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
          "grid min-h-[min(80vh,calc(100vh-8rem))] gap-0 overflow-hidden bg-card/20",
          aside
            ? "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_min(100%,400px)]"
            : "grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]",
        )}
      >
        <aside className="hidden lg:flex flex-col border-b lg:border-b-0 lg:border-r border-border bg-background/40 min-h-0 overflow-y-auto">
          {nav}
        </aside>
        <div className="lg:hidden border-b border-border p-3">{nav}</div>
        <main className="min-w-0 min-h-0 overflow-y-auto border-b lg:border-b-0 border-border">
          {main}
        </main>
        {aside ? (
          <aside className="min-h-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-border bg-background/30 p-4 xl:p-5">
            {aside}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
