import type { ComponentType, SVGProps } from "react";
import {
  AIIcon,
  ArchiveIcon,
  AssetIcon,
  CapsuleIcon,
  DashboardIcon,
  FriendIcon,
  ReminderIcon,
  TimelineIcon,
  UpdatesIcon,
} from "@/components/icons/nav-icons";

export interface NavItem {
  label: string;
  href: string;
  /** Decorativa (aria-hidden in MainNav) --- l'etichetta testuale resta il vero nome accessibile della voce. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Se true, la pagina è dietro RequireMasterKey (v. i rispettivi page.tsx) --- usato da MainNav per il pallino "richiede setup" quando la cifratura non è ancora configurata. */
  requiresEncryption: boolean;
}

/**
 * Main app navigation, per HINTHIAL_MVP.md sezione "FASE 1 --- Shell
 * dell'app". "Impostazioni" non è qui: vive nel menu a comparsa sul
 * nome utente (src/components/layout/UserMenu.tsx), insieme a "Esci".
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon, requiresEncryption: false },
  { label: "Archivio", href: "/archive", icon: ArchiveIcon, requiresEncryption: true },
  { label: "Scadenze", href: "/reminders", icon: ReminderIcon, requiresEncryption: true },
  { label: "Beni", href: "/assets", icon: AssetIcon, requiresEncryption: true },
  { label: "Amici", href: "/friends", icon: FriendIcon, requiresEncryption: true },
  { label: "Capsule", href: "/capsules", icon: CapsuleIcon, requiresEncryption: true },
  { label: "Cronologia", href: "/timeline", icon: TimelineIcon, requiresEncryption: true },
  { label: "AI", href: "/ai", icon: AIIcon, requiresEncryption: true },
  // Contenuto globale, non cifrato (v. domain/product-updates) --- non
  // richiede la master key, a differenza di ogni altra voce qui sopra
  // tranne Dashboard.
  { label: "Novità", href: "/updates", icon: UpdatesIcon, requiresEncryption: false },
];
