import { Skeleton } from "@/components/ui/skeleton";

export default function RunLoading() {
  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="border-b border-border bg-card/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-48 hidden md:block" />
          </div>
        </div>
        <div className="grid min-h-[50vh] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_min(100%,400px)] gap-0">
          <aside className="hidden lg:block border-r border-border p-4 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </aside>
          <main className="border-b lg:border-b-0 lg:border-r border-border p-5 space-y-6">
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-40 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </main>
          <aside className="p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <div className="rounded-xl border border-border p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="rounded-xl border border-border p-4 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
