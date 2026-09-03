/**
 * Tema chiaro/scuro/sistema --- una preferenza puramente d'aspetto, non
 * un dato dell'utente: vive solo in localStorage sul dispositivo, mai
 * sincronizzata col server. La lettura iniziale (prima del primo paint,
 * per evitare un flash) avviene da uno script inline duplicato in
 * app/layout.tsx --- questo modulo è per tutto il resto (il toggle in
 * Impostazioni, e per applicare un cambio dal vivo).
 */

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "hinthial-theme";

export function getStoredThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage non disponibile (privacy mode, quota, ...): il tema resta
    // solo per questa sessione, senza bloccare il toggle.
  }
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applica la preferenza al documento (classe .dark su <html>, v. globals.css). */
export function applyTheme(preference: ThemePreference): void {
  const isDark = preference === "dark" || (preference === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}
