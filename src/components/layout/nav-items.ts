export interface NavItem {
  label: string;
  href: string;
  /** Decorativa (aria-hidden in MainNav) --- l'etichetta testuale resta il vero nome accessibile della voce. */
  icon: string;
}

/**
 * Main app navigation, per HINTHIAL_MVP.md sezione "FASE 1 --- Shell
 * dell'app". "Impostazioni" non è qui: vive nel menu a comparsa sul
 * nome utente (src/components/layout/UserMenu.tsx), insieme a "Esci".
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Archivio", href: "/archive", icon: "🗄️" },
  { label: "Scadenze", href: "/reminders", icon: "⏰" },
  { label: "Asset", href: "/assets", icon: "🏠" },
  { label: "Contatti", href: "/contacts", icon: "🤝" },
  { label: "Capsule", href: "/capsules", icon: "📦" },
  { label: "Cronologia", href: "/timeline", icon: "📜" },
  { label: "AI", href: "/ai", icon: "🤖" },
];
