/**
 * FASE 18: dal testo (già estratto dalla FASE 17) ai campi --- schemi, non ragionamento, nessun modello.
 * Due regole: (1) nel dubbio non si dice niente, un campo sbagliato costa più di uno mancante; (2) ogni
 * campo porta la sua fonte (`context`), e quando ci sono più candidati plausibili si restituiscono tutti
 * invece di indovinare. Non scrive niente: la scrittura vera arriva con la FASE 19 (accetta/modifica/rifiuta).
 */

export type StructuredFieldKind = "document-date" | "expiry" | "issuer" | "title";

export interface StructuredField {
  kind: StructuredFieldKind;
  /** Forma normalizzata: `YYYY-MM-DD` per le date, `1234.56` per gli importi. */
  value: string;
  /** Come compare nel documento --- si mostra questo, non il normalizzato. */
  raw: string;
  /** Il pezzo di testo da cui viene, per poter verificare senza fidarsi. */
  context: string;
  /**
   * Vero quando il valore è stato *calcolato* e non letto: una scadenza
   * ricavata da "controllo tra dodici mesi" più la data del documento.
   * Va detto all'utente: è un conto fatto da Hinthial, non una data
   * scritta sul foglio.
   */
  derived?: boolean;
}

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

/** Senza una di queste parole prima, una data resta solo una data --- in una polizza ce ne sono cinque. */
const EXPIRY_TRIGGERS =
  /(scade il|scadenza|data di scadenza|valid[oaie]\s+fino al|validità fino al|in scadenza il|rinnovo entro|entro il)\s*[:\s]*$/i;

/** Quanto testo si guarda prima di una data per cercarci un'etichetta. */
const LABEL_LOOKBEHIND = 40;

/** Le parole che qualificano una data come "data del documento". */
const DOCUMENT_DATE_TRIGGERS =
  /(data|del|in data|emess[oa] il|rilasciat[oa] il|datat[oa]|prelievo|esecuzione|refertazione)\s*[:\s]*$/i;

function labelBefore(text: string, index: number): string {
  return text.slice(Math.max(0, index - LABEL_LOOKBEHIND), index);
}

/** Numeri scritti in lettere, per "controllo tra dodici mesi". */
const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6,
  sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12,
  diciotto: 18, venti: 20, ventiquattro: 24, trenta: 30, trentasei: 36,
};

const WORD_NUMBER_NAMES = Object.keys(WORD_NUMBERS).join("|");

/** "controllo tra dodici mesi": la parola che apre è obbligatoria, senza ogni "fra due settimane" diventerebbe una scadenza. */
const RELATIVE_EXPIRY = new RegExp(
  `(ricontroll[oa]|controll[oa]|rivalutazione|ripetere|ripetizione|rinnov[oa]|revisione|verifica|visita)` +
    `[^.\\n]{0,40}?\\b(?:tra|fra|dopo)\\s+(\\d{1,3}|${WORD_NUMBER_NAMES})\\s+(giorn[oi]|settiman[ae]|mes[ei]|ann[oi])\\b`,
  "i",
);

function addInterval(iso: string, amount: number, unit: string): string | null {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  if (unit.startsWith("giorn")) date.setUTCDate(date.getUTCDate() + amount);
  else if (unit.startsWith("settiman")) date.setUTCDate(date.getUTCDate() + amount * 7);
  else if (unit.startsWith("mes")) date.setUTCMonth(date.getUTCMonth() + amount);
  else if (unit.startsWith("ann")) date.setUTCFullYear(date.getUTCFullYear() + amount);
  else return null;

  return date.toISOString().slice(0, 10);
}

/** Forme societarie generiche + marchi/enti comuni senza forma societaria propria (Enel, TIM...); `\b` sui nomi corti per non scattare dentro "conveniente"/"vittima". */
const ISSUER_MARKERS =
  /(s\.?p\.?a\.?\b|s\.?r\.?l\.?\b|s\.?n\.?c\.?\b|s\.?a\.?s\.?\b|azienda|ospedal|poliambulator|laborator|clinic|comune di|regione|agenzia|banca|assicurazion|studio (?:medico|legale|dentistico|associato)|a\.?s\.?l\.?\b|istituto|universit|ministero|\benel\b|\beni\b|\btim\b|vodafone|windtre|wind\s*tre|iliad|\binps\b|\binail\b|poste italiane)/i;

/** Parole che aprono un *titolo*, non un emittente --- senza, "CERTIFICATO DI RESIDENZA" in cima sarebbe scambiato per un'intestazione. */
const DOCUMENT_TITLE_WORDS =
  /^(referto|certificat|fattura|ricevuta|polizza|contratto|dichiarazione|verbale|attestat|estratto|bolletta|preventivo|nota|scontrino|documento|modulo|domanda|richiesta|comunicazione|avviso)/i;

/** Quante righe dall'inizio si guardano per trovare l'emittente. */
const ISSUER_LINES = 6;
const ISSUER_MAX_CHARS = 80;

/** Ogni riga che sembra un emittente, non solo la prima --- un documento può nominarne più di uno in cima. */
function findIssuers(text: string): StructuredField[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, ISSUER_LINES);

  const found: StructuredField[] = [];

  for (const line of lines) {
    if (line.length > ISSUER_MAX_CHARS) continue;
    if (DOCUMENT_TITLE_WORDS.test(line)) continue;
    // Righe fatte quasi solo di numeri: codici, protocolli, date.
    if ((line.replace(/\D/g, "").length / line.length) > 0.3) continue;

    const words = line.split(/\s+/).filter((w) => w.length > 1);
    if (words.length < 2) continue;

    const hasMarker = ISSUER_MARKERS.test(line);
    // Il maiuscolo da solo basta solo in cima: è la convenzione di ogni
    // carta intestata, ma più in basso nel documento vuol dire altro.
    const isShouted = line === line.toUpperCase() && /\p{L}/u.test(line);

    if (hasMarker || isShouted) {
      found.push({ kind: "issuer", value: line, raw: line, context: line });
    }
  }

  return found;
}

/** Quanto può essere lungo un titolo proposto: oltre, in un elenco non si legge. */
const MAX_TITLE_CHARS = 70;

/** FASE 19b: un nome leggibile al posto di `scan_0012.pdf` --- unisce la riga che descrive il documento (scartata da findIssuers) con chi l'ha emesso. */
function findTitle(text: string, issuer: string | null): StructuredField | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, ISSUER_LINES);

  const described = lines.find(
    (line) => DOCUMENT_TITLE_WORDS.test(line) && line.length <= MAX_TITLE_CHARS,
  );
  if (!described) return null;

  // Solo il titolo si ammorbidisce da tutto maiuscolo; l'emittente resta com'è, è un nome proprio.
  const label = toSentenceCase(described);
  const full = issuer ? `${label} --- ${issuer}` : label;

  return {
    kind: "title",
    value: full.length > MAX_TITLE_CHARS ? label : full,
    raw: described,
    context: described,
  };
}

function toSentenceCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** FASE 19b: la frase da cui viene questa data, per mostrarla quando l'utente corregge una proposta. Confronto tra date normalizzate, non stringhe --- cercare il testo letterale non troverebbe mai niente. `null` se quella data non è scritta nel documento (succede spesso, non è un errore). */
export function findDateContext(text: string, iso: string): string | null {
  const match = findDates(text).find((date) => date.iso === iso);
  if (!match) return null;
  return contextAround(text, match.index, match.raw.length);
}

export function extractStructuredFields(text: string): StructuredField[] {
  if (!text.trim()) return [];

  const fields: StructuredField[] = [];
  const dates = findDates(text);

  // --- Scadenza dichiarata: ogni data preceduta da una parola che la
  // qualifica come tale --- più di una possibile (una polizza può
  // nominarne due, una scritta e una da ricontrollare a mano): si
  // mostrano tutte, invece di scommettere su quale sia quella giusta.
  const expiryMatches = dates.filter((date) => EXPIRY_TRIGGERS.test(labelBefore(text, date.index)));
  for (const expiryDate of expiryMatches) {
    fields.push({
      kind: "expiry",
      value: expiryDate.iso,
      raw: expiryDate.raw,
      context: contextAround(text, expiryDate.index, expiryDate.raw.length),
    });
  }

  // --- Data del documento: quella etichettata, altrimenti la prima ---
  // escludendo quelle già prese come scadenza, che sono un'altra cosa.
  const candidates = dates.filter((date) => !expiryMatches.includes(date));
  const documentDate =
    candidates.find((date) => DOCUMENT_DATE_TRIGGERS.test(labelBefore(text, date.index))) ??
    candidates[0];

  if (documentDate) {
    fields.push({
      kind: "document-date",
      value: documentDate.iso,
      raw: documentDate.raw,
      context: contextAround(text, documentDate.index, documentDate.raw.length),
    });
  }

  // --- Scadenza ricavata da un intervallo ("controllo tra dodici mesi").
  // Solo se non c'è già almeno una scadenza scritta esplicitamente, e se
  // c'è una data del documento da cui contare: contare da oggi sarebbe
  // sbagliato per qualunque documento archiviato in ritardo, ed è
  // proprio la maggioranza.
  if (expiryMatches.length === 0 && documentDate) {
    const relative = RELATIVE_EXPIRY.exec(text);
    if (relative) {
      const amount = WORD_NUMBERS[relative[2].toLowerCase()] ?? Number(relative[2]);
      const iso = Number.isFinite(amount) ? addInterval(documentDate.iso, amount, relative[3].toLowerCase()) : null;
      if (iso) {
        fields.push({
          kind: "expiry",
          value: iso,
          raw: relative[0].replace(/\s+/g, " ").trim(),
          context: contextAround(text, relative.index, relative[0].length),
          derived: true,
        });
      }
    }
  }

  const issuers = findIssuers(text);
  fields.push(...issuers);

  const title = findTitle(text, issuers[0]?.value ?? null);
  if (title) fields.push(title);

  return fields;
}
