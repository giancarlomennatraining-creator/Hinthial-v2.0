/**
 * Quali voci di NAV_ITEMS (v. components/layout/nav-items.ts) appaiono
 * nella barra fissa in basso su smartphone, invece che solo dentro il
 * menu con le 3 lineette --- scelta dall'utente in Impostazioni >
 * Aspetto, sincronizzata su tutti i dispositivi (profiles.bottom_nav_items),
 * come la disposizione del menu (v. lib/nav-orientation.ts).
 */

export type BottomNavItems = string[];

export const DEFAULT_BOTTOM_NAV_ITEMS: BottomNavItems = [
  "/dashboard",
  "/archive",
  "/reminders",
  "/capsules",
];

/** Oltre questo numero la barra in basso diventerebbe troppo stretta per restare leggibile su schermi piccoli. */
export const MAX_BOTTOM_NAV_ITEMS = 4;

/**
 * Legge il valore grezzo (jsonb) dalla riga di profiles: un array di
 * href, filtrato sui soli valori che sono ancora voci valide di
 * NAV_ITEMS (così una voce rimossa in futuro non lascia un href morto),
 * senza duplicati, e limitato a MAX_BOTTOM_NAV_ITEMS.
 */
export function parseBottomNavItems(raw: unknown, validHrefs: readonly string[]): BottomNavItems {
  if (!Array.isArray(raw)) return DEFAULT_BOTTOM_NAV_ITEMS.filter((href) => validHrefs.includes(href));

  const result: BottomNavItems = [];
  for (const value of raw) {
    if (typeof value === "string" && validHrefs.includes(value) && !result.includes(value)) {
      result.push(value);
    }
    if (result.length >= MAX_BOTTOM_NAV_ITEMS) break;
  }
  return result;
}
