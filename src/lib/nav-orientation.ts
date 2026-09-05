/**
 * Disposizione del menu di navigazione principale --- verticale (barra
 * laterale a sinistra o a destra) oppure orizzontale (barra in alto).
 * Gestita da Impostazioni > Aspetto, sincronizzata sul server
 * (profiles.nav_orientation) --- come la visualizzazione delle liste
 * (v. lib/list-view.ts), a differenza del tema chiaro/scuro che resta
 * solo locale: la scelta segue l'utente su tutti i suoi dispositivi.
 */

export type NavOrientation = "sidebar-left" | "sidebar-right" | "topbar";

export const DEFAULT_NAV_ORIENTATION: NavOrientation = "sidebar-left";

export const NAV_ORIENTATION_LABEL: Record<NavOrientation, string> = {
  "sidebar-left": "Verticale (a sinistra)",
  "sidebar-right": "Verticale (a destra)",
  topbar: "Orizzontale (in alto)",
};

export const NAV_ORIENTATIONS: NavOrientation[] = ["sidebar-left", "sidebar-right", "topbar"];

/** Legge il valore grezzo dalla riga di profiles, ignorando valori inattesi. */
export function parseNavOrientation(raw: unknown): NavOrientation {
  if (raw === "sidebar-left" || raw === "sidebar-right" || raw === "topbar") return raw;
  return DEFAULT_NAV_ORIENTATION;
}
