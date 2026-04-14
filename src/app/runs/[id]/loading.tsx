import { Skeleton } from "@/components/ui/skeleton";

export default function RunLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="flex items-center gap-3 mt-3">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-28 rounded" />
        </div>
        <Skeleton className="h-4 w-56 mt-2" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-32 w-full mt-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <aside>
          <div className="lg:sticky lg:top-8 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
