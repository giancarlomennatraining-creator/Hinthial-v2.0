"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Le sezioni dell'Archivio: `paths` sono i percorsi che tengono accesa la scheda (la prima è dove porta il link). */
const TABS = [
  { label: "Contenuti", paths: ["/archive"], exclude: ["/archive/trash"] },
  { label: "Fascicoli", paths: ["/dossiers"], exclude: [] },
  { label: "Beni", paths: ["/assets"], exclude: [] },
  { label: "Scadenze", paths: ["/reminders"], exclude: [] },
  { label: "Cestino", paths: ["/archive/trash"], exclude: [] },
] as const;

function isActive(tab: (typeof TABS)[number], pathname: string | null): boolean {
  if (!pathname) return false;
  const inside = tab.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const excluded = tab.exclude.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return inside && !excluded;
}

/**
 * Contenuti, fascicoli, beni, scadenze e cestino non sono voci di menu a sé: sono modi diversi di guardare lo stesso
 * Archivio, qui schede della stessa sezione. Sono link veri a pagine distinte (/archive, /dossiers, /assets,
 * /reminders): ognuna ha la sua lista, creazione, scheda. Niente `role="tab"` (che implica restare sulla stessa
 * pagina): sono link di navigazione vera, `aria-current="page"` come in MainNav.
 */
export function ArchiveTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sezioni dell'Archivio" className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <Link
            key={tab.label}
            href={tab.paths[0]}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
