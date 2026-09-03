/** A single pulsing placeholder block --- the building block for every loading skeleton in the app. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`}
    />
  );
}

/**
 * Placeholder for a list panel while its data is being fetched and
 * decrypted (Documenti, Asset, Scadenze, Contatti, Capsule) --- same
 * bordered/divided container as the real list, so the page doesn't
 * visibly jump once the content arrives. One generic row shape (a title
 * line, a subtitle line, a trailing badge) approximates all five list
 * kinds well enough; it's a loading cue, not a preview of the real data.
 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Caricamento…"
      className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
