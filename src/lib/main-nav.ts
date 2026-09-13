import { NAV_ITEMS } from "@/components/layout/nav-items";

/**
 * Quali voci di NAV_ITEMS compaiono nella barra di navigazione generale
 * (sidebar o barra orizzontale, v. Sidebar/TopNav), e in che ordine ---
 * scelta dall'utente in Impostazioni > Aspetto, sincronizzata su tutti i
 * dispositivi (profiles.main_nav_items), stesso schema di
 * bottom_nav_items. A differenza di quella (un sottoinsieme scelto
 * apposta, il resto resta comunque raggiungibile dal menu con le 3
 * lineette su mobile), qui non c'è un "altrove" dove ritrovare una voce
 * nascosta dalla barra generale: nasconderla è una scelta esplicita di
 * semplificazione dell'utente, non una selezione tra voci equivalenti.
 */
export type MainNavItems = string[];

export const DEFAULT_MAIN_NAV_ITEMS: MainNavItems = NAV_ITEMS.map((item) => item.href);

/**
 * Legge il valore grezzo (jsonb) dalla riga di profiles: un array di
 * href nell'ordine scelto dall'utente, filtrato sui soli valori ancora
 * validi (così una voce rimossa in futuro non lascia un href morto) e
 * senza duplicati --- stesso schema di parseBottomNavItems. Se non è mai
 * stato personalizzato (valore assente), il default è l'intero elenco,
 * nell'ordine di NAV_ITEMS: la barra generale mostra tutto finché
 * l'utente non sceglie altrimenti.
 */
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
