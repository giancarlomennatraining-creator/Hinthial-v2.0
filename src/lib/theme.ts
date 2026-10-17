/**
 * Tema chiaro/scuro/sistema, e stile (Foglia, Notte, Luce) --- una preferenza puramente d'aspetto, non
 * un dato dell'utente: vive solo in localStorage sul dispositivo, mai
 * sincronizzata col server. La lettura iniziale (prima del primo paint,
 * per evitare un flash) avviene da uno script inline duplicato in
 * app/layout.tsx --- questo modulo è per tutto il resto (il toggle in
 * Impostazioni, e per applicare un cambio dal vivo).
 */

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "hinthial-theme";

/**
 * Lo stile è un'altra scelta, indipendente da chiaro/scuro: sei combinazioni. Foglia è il predefinito. Vale lo stesso
 * principio del tema (solo sul dispositivo, applicato prima del primo paint dallo script in app/layout.tsx), come
 * attributo `data-stile` su <html>: v. globals.css.
 */
export type StylePreference = "foglia" | "notte" | "luce";

export const STYLES: StylePreference[] = ["foglia", "notte", "luce"];
export const DEFAULT_STYLE: StylePreference = "foglia";

const STYLE_STORAGE_KEY = "hinthial-stile";

export function getStoredStylePreference(): StylePreference {
  try {
    const stored = window.localStorage.getItem(STYLE_STORAGE_KEY);
    return STYLES.includes(stored as StylePreference) ? (stored as StylePreference) : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
}

export function storeStylePreference(style: StylePreference): void {
  try {
    window.localStorage.setItem(STYLE_STORAGE_KEY, style);
  } catch {
    // Storage non disponibile: lo stile resta solo per questa sessione.
  }
}

/** Applica lo stile al documento (attributo `data-stile` su <html>, v. globals.css). */
export function applyStyle(style: StylePreference): void {
  document.documentElement.setAttribute("data-stile", style);
}

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
