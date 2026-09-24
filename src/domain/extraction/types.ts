/**
 * FASE 17: lettura del contenuto interamente sul dispositivo, prima della cifratura --- nessun byte lascia il browser,
 * quindi non serve consenso. Stesso schema a provider di Categorizer/TranscriptionProvider/AIProvider: interfaccia
 * stabile, implementazioni sostituibili (oggi PDF e immagini; la trascrizione si aggiungerà senza toccare i chiamanti).
 */
export interface TextExtractor {
  /** Mostrato in UI/log quando è utile sapere quale motore ha risposto. */
  readonly name: string;
  /** I tipi MIME che questo motore sa leggere. */
  supports(mimeType: string): boolean;
  /** Null se non c'è nulla da estrarre (es. una scansione senza OCR ancora) --- non deve mai lanciare, è best-effort. */
  extract(
    bytes: Uint8Array,
    mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<string | null>;
}

/** 0-1, per i motori che ci mettono abbastanza da doverlo dire (l'OCR richiede secondi, non millisecondi). */
export type ExtractionProgress = (fraction: number) => void;

/** Un PDF di mille pagine produrrebbe megabyte di testo da cifrare/trasferire --- i primi ~200.000 caratteri bastano per cercarci dentro. */
export const MAX_EXTRACTED_CHARS = 200_000;

/**
 * Ripulisce il testo e lo taglia al tetto, **conservando gli a capo** (fino alla FASE 17d venivano schiacciati, andava
 * bene per la ricerca ma rendeva illeggibile la pagina di dettaglio, FASE 17e). La ricerca appiattisce per conto suo
 * (v. lib/text-snippet.ts, flattenForSearch).
 */
export function normalizeExtractedText(raw: string): string | null {
  const collapsed = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    // Al massimo una riga vuota di separazione: scansioni e PDF producono spesso decine di a capo consecutivi.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!collapsed) return null;
  return collapsed.length > MAX_EXTRACTED_CHARS ? collapsed.slice(0, MAX_EXTRACTED_CHARS) : collapsed;
}
