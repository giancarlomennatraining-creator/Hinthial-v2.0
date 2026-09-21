"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * FASE 20b --- il fascicolo non è più una voce di menu a sé (v.
 * components/layout/nav-items.ts): è un modo diverso di guardare
 * l'Archivio, non un oggetto indipendente come Amici o Capsule. Qui
 * diventa una seconda scheda della stessa sezione.
 *
 * Sono link veri a due pagine distinte (/archive e /dossiers), non due
 * pannelli di uno stesso componente scambiati via stato --- un fascicolo
 * ha una sua lista, una sua creazione, una sua scheda: fonderlo in un
 * solo componente sarebbe più complicato, non più semplice. Per questo
 * non usa `role="tab"` (che implica restare sulla stessa pagina, un
 * pannello mostrato/nascosto via JS): sono link di navigazione vera, e
 * `aria-current="page"` è lo stesso modo in cui MainNav segna già la
 * voce attiva.
 */
export function ArchiveTabs() {
  const pathname = usePathname();
  const isDossiers = pathname?.startsWith("/dossiers") ?? false;

  return (
    <nav aria-label="Sezioni dell'Archivio" className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      <Link
        href="/archive"
        aria-current={!isDossiers ? "page" : undefined}
        className={cn(
          "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          !isDossiers
            ? "border-brand text-brand"
            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        )}
      >
        Contenuti
      </Link>
      <Link
        href="/dossiers"
        aria-current={isDossiers ? "page" : undefined}
        className={cn(
          "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isDossiers
            ? "border-brand text-brand"
            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        )}
      >
        Fascicolo
      </Link>
    </nav>
  );
}
