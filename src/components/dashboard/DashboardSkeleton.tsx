import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder shown while the dashboard's AIContext is fetched/decrypted --- mirrors its usual shape (two columns, the first wider: counters + three sections, then a guide/watchlist column) so the page doesn't jump once real content arrives. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Caricamento…" className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
