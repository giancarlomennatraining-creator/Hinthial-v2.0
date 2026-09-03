/**
 * Ordinamento lessicografico (alfabetico, come sortAlphabetically in
 * utils.ts, non numerico/cronologico) delle tabelle di ogni sezione
 * (v. componenti *Panel.tsx, modalità tabellare) --- un click
 * sull'intestazione di una colonna ordina per quella colonna, un
 * secondo click inverte la direzione. Ogni pannello inizializza il
 * proprio stato `sort` già sulla prima colonna, crescente (A→Z) --- non
 * più `null`/nessun ordinamento --- così la tabella parte già ordinata.
 */

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** Stesso confronto locale di sortAlphabetically --- "it", case-insensitive. */
export function compareLexicographically(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, "it", { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

/** Click sulla stessa colonna -> inverte direzione; su una diversa -> riparte da "asc". */
export function toggleSort<K extends string>(current: SortState<K> | null, key: K): SortState<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: "asc" };
}

/** Ordina una copia dell'array secondo sort (se presente) --- getValue converte ogni riga nel testo della colonna attiva. */
export function applySort<T, K extends string>(
  items: T[],
  sort: SortState<K> | null,
  getValue: (item: T, key: K) => string,
): T[] {
  if (!sort) return items;
  return [...items].sort((a, b) =>
    compareLexicographically(getValue(a, sort.key), getValue(b, sort.key), sort.direction),
  );
}
