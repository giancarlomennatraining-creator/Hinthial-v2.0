export interface NavItem {
  label: string;
  href: string;
  /** Decorativa (aria-hidden in MainNav) --- l'etichetta testuale resta il vero nome accessibile della voce. */
  icon: string;
  /** Se true, la pagina è dietro RequireMasterKey (v. i rispettivi page.tsx) --- usato da MainNav per il pallino "richiede setup" quando la cifratura non è ancora configurata. */
  requiresEncryption: boolean;
}

/**
 * Main app navigation, per HINTHIAL_MVP.md sezione "FASE 1 --- Shell
 * dell'app". "Impostazioni" non è qui: vive nel menu a comparsa sul
 * nome utente (src/components/layout/UserMenu.tsx), insieme a "Esci".
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", requiresEncryption: false },
  { label: "Archivio", href: "/archive", icon: "🗄️", requiresEncryption: true },
  { label: "Scadenze", href: "/reminders", icon: "⏰", requiresEncryption: true },
  { label: "Asset", href: "/assets", icon: "🏠", requiresEncryption: true },
  { label: "Contatti", href: "/contacts", icon: "🤝", requiresEncryption: true },
  { label: "Capsule", href: "/capsules", icon: "📦", requiresEncryption: true },
  { label: "Cronologia", href: "/timeline", icon: "📜", requiresEncryption: true },
  { label: "AI", href: "/ai", icon: "🤖", requiresEncryption: true },
];
