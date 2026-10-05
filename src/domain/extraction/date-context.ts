/**
 * Le date scritte in un testo (in lettere, numeriche, ISO) e la frase attorno a ciascuna. Serve alla validazione
 * dell'analisi di Hinthia per controllare che una data letta compaia davvero nella citazione che la prova.
 */

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6,
  lug: 7, ago: 8, set: 9, sett: 9, ott: 10, nov: 11, dic: 12,
};

const MONTH_NAMES = Object.keys(MONTHS).join("|");

/** `14 marzo 2026`, `14 mar 2026`. */
const TEXTUAL_DATE = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\.?\\s+(\\d{4})\\b`, "gi");

/**
 * `14/03/2026`, `14-03-26`. Il punto come separatore è escluso di
 * proposito: `2.1.3` e `art. 5.2.1` sarebbero date perfette, e in un
 * contratto ce n'è a decine.
 */
const NUMERIC_DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/g;

/** `2026-03-14`, il formato delle esportazioni. */
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

interface FoundDate {
  iso: string;
  raw: string;
  index: number;
}

/** Anni fuori da questa forchetta sono quasi sempre un errore di lettura. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

function toIso(day: number, month: number, year: number): string | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Il 31 febbraio esiste solo negli OCR sbagliati: si costruisce la data
  // e si verifica che sia rimasta quella chiesta.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;

  return date.toISOString().slice(0, 10);
}

/** Anno a due cifre: `98` -> 1998, `26` -> 2026. Convenzione POSIX. */
function expandYear(raw: string): number {
  const year = Number(raw);
  if (raw.length === 4) return year;
  return year < 70 ? 2000 + year : 1900 + year;
}

/** Tutte le date riconoscibili nel testo, in ordine di comparsa. */
function findDates(text: string): FoundDate[] {
  const found: FoundDate[] = [];

  for (const match of text.matchAll(TEXTUAL_DATE)) {
    const iso = toIso(Number(match[1]), MONTHS[match[2].toLowerCase()], Number(match[3]));
    if (iso) found.push({ iso, raw: match[0], index: match.index });
  }

  for (const match of text.matchAll(NUMERIC_DATE)) {
    // Giorno/mese e non mese/giorno: è un prodotto italiano, e su un
    // documento italiano "03/04" è il 3 aprile.
    const iso = toIso(Number(match[1]), Number(match[2]), expandYear(match[3]));
    if (iso) found.push({ iso, raw: match[0], index: match.index });
  }

  for (const match of text.matchAll(ISO_DATE)) {
    const iso = toIso(Number(match[3]), Number(match[2]), Number(match[1]));
    if (iso) found.push({ iso, raw: match[0], index: match.index });
  }

  return found.sort((a, b) => a.index - b.index);
}

/** Il contorno di ciò che si è trovato, su una riga sola. */
const CONTEXT_CHARS = 45;

function contextAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - CONTEXT_CHARS);
  const end = Math.min(text.length, index + length + CONTEXT_CHARS);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}


/** FASE 19b: la frase da cui viene questa data, per mostrarla quando l'utente corregge una proposta. Confronto tra date normalizzate, non stringhe --- cercare il testo letterale non troverebbe mai niente. `null` se quella data non è scritta nel documento (succede spesso, non è un errore). */
export function findDateContext(text: string, iso: string): string | null {
  const match = findDates(text).find((date) => date.iso === iso);
  if (!match) return null;
  return contextAround(text, match.index, match.raw.length);
}
