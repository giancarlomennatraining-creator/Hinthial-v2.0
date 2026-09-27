"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Il fascicolo non è una voce di menu a sé: è un modo diverso di guardare l'Archivio, qui una seconda scheda della
 * stessa sezione. Sono link veri a due pagine distinte (/archive e /dossiers), non pannelli scambiati via stato: un
 * fascicolo ha una sua lista, creazione, scheda. Niente `role="tab"` (che implica restare sulla stessa pagina):
 * sono link di navigazione vera, `aria-current="page"` come in MainNav.
 */
export function ArchiveTabs() {
  const pathname = usePathname();
  const isTrash = pathname?.startsWith("/archive/trash") ?? false;
  const isDossiers = pathname?.startsWith("/dossiers") ?? false;
  const isContents = !isDossiers && !isTrash;

  return (
    <nav aria-label="Sezioni dell'Archivio" className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
      <Link
        href="/archive"
        aria-current={isContents ? "page" : undefined}
        className={cn(
          "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isContents
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
      {/* Cestino: un'altra vista sullo stesso Archivio (documenti con deleted_at impostato), non una sezione indipendente. */}
      <Link
        href="/archive/trash"
        aria-current={isTrash ? "page" : undefined}
        className={cn(
          "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
          isTrash
            ? "border-brand text-brand"
            : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        )}
      >
        🗑️ Cestino
      </Link>
    </nav>
  );
}
