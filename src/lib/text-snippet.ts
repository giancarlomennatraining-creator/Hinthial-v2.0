/** Il pezzo di testo attorno alla parola cercata, per spiegare perché un documento è comparso tra i risultati. Tutto in memoria, su testo già decifrato: nessuna ricerca lato server, impossibile sui contenuti cifrati. */

/** Quanti caratteri mostrare prima e dopo la parola trovata. */
const CONTEXT_CHARS = 60;

/**
 * Il testo come lo vede la ricerca: tutto su una riga. Il testo estratto conserva l'impaginazione perché viene
 * mostrato all'utente, ma la ricerca non deve accorgersene: chi cerca "risonanza magnetica" deve trovarlo anche se
 * le due parole stanno su righe diverse nel documento.
 */
export function flattenForSearch(text: string): string {
  return text.replace(/\s+/g, " ");
}

export interface TextSnippet {
  /** Testo prima della corrispondenza (già tagliato). */
  before: string;
  /** La corrispondenza, nella forma in cui compare nel testo, non come l'hai digitata. */
  match: string;
  /** Testo dopo la corrispondenza (già tagliato). */
  after: string;
  /** Se il testo continua prima/dopo il pezzo mostrato (per i puntini). */
  truncatedStart: boolean;
  truncatedEnd: boolean;
}

/**
 * Il primo termine della ricerca che compare nel testo, col contorno. null se nessuno compare: il documento allora
 * è stato trovato per altro e non c'è niente da spiegare. Il taglio si ferma al confine di parola più vicino,
 * quando ragionevole: uno spezzone che comincia a metà parola si legge peggio di uno leggermente più corto.
 */
export function findTextSnippet(text: string, query: string): TextSnippet | null {
  // Appiattito: lo spezzone è una riga sola dentro un risultato di ricerca, gli a capo non servono a niente.
  const trimmed = flattenForSearch(text).trim();
  if (!trimmed) return null;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);
  if (terms.length === 0) return null;

  const haystack = trimmed.toLowerCase();

  let index = -1;
  let term = "";
  for (const candidate of terms) {
    const found = haystack.indexOf(candidate);
    if (found !== -1 && (index === -1 || found < index)) {
      index = found;
      term = candidate;
    }
  }
  if (index === -1) return null;

  const rawStart = Math.max(0, index - CONTEXT_CHARS);
  const rawEnd = Math.min(trimmed.length, index + term.length + CONTEXT_CHARS);

  // Allinea al confine di parola senza mangiare troppo: se lo spazio più vicino è lontano, meglio tagliare a metà parola.
  const spaceAfterStart = trimmed.indexOf(" ", rawStart);
  const start =
    rawStart > 0 && spaceAfterStart !== -1 && spaceAfterStart < index && spaceAfterStart - rawStart < 15
      ? spaceAfterStart + 1
      : rawStart;

  const spaceBeforeEnd = trimmed.lastIndexOf(" ", rawEnd);
  const end =
    rawEnd < trimmed.length &&
    spaceBeforeEnd > index + term.length &&
    rawEnd - spaceBeforeEnd < 15
      ? spaceBeforeEnd
      : rawEnd;

  return {
    before: trimmed.slice(start, index),
    match: trimmed.slice(index, index + term.length),
    after: trimmed.slice(index + term.length, end),
    truncatedStart: start > 0,
    truncatedEnd: end < trimmed.length,
  };
}
