"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { backTarget, type BackTarget } from "@/lib/back-target";
import { recordNavigation, referringPath } from "@/lib/navigation-history";
import { cn } from "@/lib/utils";

/**
 * Lo stile di ogni "← Torna a…": verde d'accento, in grassetto, con un'area da toccare di almeno 44 px su telefono e uno
 * sfondo che compare al passaggio. Prima erano righe piccole e grigie, scritte in modo diverso da una pagina all'altra, e si
 * perdevano sopra il titolo. Esportato anche per i pulsanti "indietro" che non sono link (la rubrica, le Impostazioni).
 */
export const BACK_LINK_CLASS =
  "-ml-3 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-brand/10 hover:text-accent-hover focus-visible:bg-brand/10 sm:min-h-9";

/** Il ritorno al genitore, sempre lo stesso: per le pagine che hanno un solo posto da cui si arriva (moduli, elenchi). */
export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(BACK_LINK_CLASS, className)}>
      ← {children}
    </Link>
  );
}

/**
 * Il ritorno di una pagina di dettaglio: alla pagina da cui si è arrivati, se ne ha una che ha senso (da un fascicolo, da
 * Oggi, da una capsula…), altrimenti al genitore (v. lib/back-target.ts).
 */
export function ContextBackLink({ parent, className }: { parent: BackTarget; className?: string }) {
  const pathname = usePathname();
  const target = backTarget(referringPath(pathname), pathname, parent);
  return <BackLink href={target.href} className={className}>{target.label}</BackLink>;
}

/** Registra ogni pagina visitata, per il ritorno dei dettagli: sta una volta sola nella shell, non mostra nulla. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    recordNavigation(pathname);
  }, [pathname]);
  return null;
}
