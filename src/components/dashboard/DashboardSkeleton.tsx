import { Skeleton } from "@/components/ui/Skeleton";
import { PANEL } from "@/components/ui/styles";

/** Placeholder mostrato mentre si leggono e decifrano i dati di "Oggi" --- ne riprende la forma (il piano in alto, sotto due riquadri affiancati) perché la pagina non salti quando arriva il contenuto vero. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Caricamento…" className="flex flex-col gap-6">
      <div className={`${PANEL} flex flex-col gap-3 p-4`}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={`${PANEL} flex flex-col gap-2 p-4`}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
