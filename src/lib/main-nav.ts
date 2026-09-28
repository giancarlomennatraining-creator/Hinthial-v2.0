import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Quali voci di NAV_ITEMS compaiono nella barra di navigazione generale, e in che ordine, scelta dall'utente in
 * Impostazioni > Aspetto e sincronizzata su tutti i dispositivi. A differenza di bottom_nav_items, qui non c'è un
 * "altrove" dove ritrovare una voce nascosta: nasconderla è una scelta esplicita di semplificazione.
 */
export type MainNavItems = string[];

export const DEFAULT_MAIN_NAV_ITEMS: MainNavItems = NAV_ITEMS.map((item) => item.href);

/** Legge il valore grezzo (jsonb) da profiles: un array di href filtrato sui soli valori ancora validi e senza duplicati. Se mai personalizzato, il default è l'intero elenco nell'ordine di NAV_ITEMS. */
export function parseMainNavItems(raw: unknown, validHrefs: readonly string[] = DEFAULT_MAIN_NAV_ITEMS): MainNavItems {
  if (!Array.isArray(raw)) return [...validHrefs];

  const known = new Set(validHrefs);
  const seen = new Set<string>();
  const result: MainNavItems = [];
  for (const value of raw) {
    if (typeof value === "string" && known.has(value) && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}
