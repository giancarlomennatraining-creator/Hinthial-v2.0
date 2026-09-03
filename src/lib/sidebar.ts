/**
 * Barra laterale espansa/compressa --- una preferenza puramente
 * d'aspetto/ergonomia legata a questo dispositivo (come il tema, v.
 * lib/theme.ts): vive solo in localStorage, mai sincronizzata col
 * server.
 */

const STORAGE_KEY = "hinthial-sidebar-collapsed";

export function getStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function storeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage non disponibile (privacy mode, quota, ...): resta solo per questa sessione.
  }
}
