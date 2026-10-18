/**
 * La memoria, in questa scheda e solo finché è aperta, delle ultime due pagine dell'app visitate: serve a "Torna indietro"
 * dei dettagli (v. back-target.ts). Non è la cronologia del browser, che le pagine non possono leggere, e non esce mai dal
 * dispositivo: due percorsi in una variabile, senza contenuti. Una ricarica la azzera (e il ritorno è il genitore).
 */
let previous: string | null = null;
let current: string | null = null;

/** Da chiamare a ogni cambio di pagina (v. NavigationTracker). */
export function recordNavigation(pathname: string): void {
  if (pathname === current) return;
  previous = current;
  current = pathname;
}

/**
 * La pagina da cui si è arrivati a `here`. Chi la chiede durante il render della pagina nuova trova ancora la vecchia in
 * `current` (il tracker aggiorna dopo il render): si copre entrambi i casi.
 */
export function referringPath(here: string): string | null {
  return current !== null && current !== here ? current : previous;
}

/** Solo per i test. */
export function resetNavigationHistory(): void {
  previous = null;
  current = null;
}
