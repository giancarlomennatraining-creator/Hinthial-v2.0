"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const navRef = useRef<HTMLElement>(null);
  // Da quale lato ci sono schede fuori vista: lì il bordo sfuma, così si capisce che la riga continua.
  const [more, setMore] = useState({ left: false, right: false });

  // Sul telefono la scheda attiva può stare fuori vista (il Cestino, l'ultima): la riga ci scorre da sola, centrandola.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
    function update() {
      if (!nav) return;
      setMore({ left: nav.scrollLeft > 2, right: nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2 });
    }
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  // cn() non fonde classi in conflitto (v. lib/utils.ts): una maschera intera per ciascun caso.
  const fade =
    more.left && more.right
      ? "[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%_-_28px),transparent)]"
      : more.right
        ? "[mask-image:linear-gradient(to_right,black_calc(100%_-_28px),transparent)]"
        : more.left
          ? "[mask-image:linear-gradient(to_right,transparent,black_28px)]"
          : undefined;

  return (
    // Scorre in orizzontale (sul telefono le cinque schede non ci stanno), ma senza barra di scorrimento visibile. La riga
    // di fondo è un'ombra interna, non un bordo: con il bordo ogni scheda doveva sporgere di 1px (-mb-px) per coprirlo, e
    // quel pixel faceva comparire anche una barra di scorrimento verticale con le sue frecce.
    <nav
      ref={navRef}
      aria-label="Sezioni dell'Archivio"
      className={cn(
        "relative flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-zinc-200)] [scrollbar-width:none] dark:shadow-[inset_0_-1px_0_var(--color-zinc-800)] [&::-webkit-scrollbar]:hidden",
        fade,
      )}
    >
      {TABS.map((tab) => {
        const active = isActive(tab, pathname);
        return (
          <Link
            key={tab.label}
            href={tab.paths[0]}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-brand text-accent"
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
