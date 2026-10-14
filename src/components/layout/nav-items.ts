import type { ComponentType, SVGProps } from "react";
import {
  AIIcon,
  ArchiveIcon,
  CapsuleIcon,
  DashboardIcon,
  FriendIcon,
  HeartIcon,
} from "@/components/icons/nav-icons";

export interface NavItem {
  label: string;
  href: string;
  /** Decorativa (aria-hidden in MainNav) --- l'etichetta testuale resta il vero nome accessibile della voce. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Se true, la pagina è dietro RequireMasterKey (v. i rispettivi page.tsx) --- usato da MainNav per il pallino "richiede setup" quando la cifratura non è ancora configurata. */
  requiresEncryption: boolean;
  /** Altre sezioni che vivono dentro questa voce (le schede dell'Archivio): la tengono accesa nel menu. */
  also?: string[];
}

/**
 * La navigazione di Hinthial, uguale per tutti e non personalizzabile: racconta cosa è Hinthial (ciò che sai e ciò che hai,
 * per le persone che ami), non un elenco di strumenti. "Impostazioni" non è qui: vive nel menu a comparsa sul nome utente
 * (UserMenu.tsx), insieme a "Esci".
 *
 * L'Archivio contiene Contenuti, Fascicoli, Beni e Scadenze come schede (v. ArchiveTabs). "Oggi" è la home (/dashboard).
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Oggi", href: "/dashboard", icon: DashboardIcon, requiresEncryption: false },
  { label: "Amici", href: "/friends", icon: FriendIcon, requiresEncryption: true },
  { label: "Capsule", href: "/capsules", icon: CapsuleIcon, requiresEncryption: true },
  { label: "Eredità digitale", href: "/legacy", icon: HeartIcon, requiresEncryption: false },
  {
    label: "Archivio",
    href: "/archive",
    icon: ArchiveIcon,
    requiresEncryption: true,
    also: ["/dossiers", "/assets", "/reminders"],
  },
  { label: "Raccontami", href: "/raccontami", icon: AIIcon, requiresEncryption: true },
];

/** Le voci della barra fissa in basso su smartphone (al massimo cinque, per restare leggibili); le altre stanno nel menu con le 3 lineette. */
export const BOTTOM_NAV_HREFS: string[] = ["/dashboard", "/capsules", "/archive", "/friends", "/legacy"];

/** Se la voce è quella della pagina in cui ci si trova (o di una sezione che vive dentro di lei). */
export function isNavItemActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  return [item.href, ...(item.also ?? [])].some((href) => pathname === href || pathname.startsWith(`${href}/`));
}
