export interface NavItem {
  label: string;
  href: string;
}

/**
 * Main app navigation, per HINTHIAL_MVP.md sezione "FASE 1 --- Shell
 * dell'app". "Impostazioni" non è qui: vive nel menu a comparsa sul
 * nome utente (src/components/layout/UserMenu.tsx), insieme a "Esci".
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Documenti", href: "/documenti" },
  { label: "Scadenze", href: "/reminders" },
  { label: "Asset", href: "/assets" },
  { label: "Contatti", href: "/contacts" },
  { label: "Capsule", href: "/capsules" },
  { label: "AI", href: "/ai" },
];
