import { ListSkeleton } from "@/components/ui/Skeleton";

/**
 * Cosa si vede dietro la finestra di sblocco, nelle pagine che servono la chiave: la forma di un elenco, senza dati.
 * Resta così anche mentre la finestra si dissolve dopo lo sblocco: la pagina si popola solo quando l'animazione è finita.
 */
export function LockedPlaceholder() {
  return (
    <div>
      <p className="sr-only">La cassaforte è bloccata.</p>
      <div aria-hidden="true">
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
