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
  /**
   * Il contenuto letto: testo, segmenti per pagina, ispezione tecnica. `text` è null se non c'è nulla da estrarre (es.
   * una scansione senza OCR ancora), ma l'ispezione tecnica c'è comunque. Può lanciare: chi chiama (extract-text.ts) lo
   * trasforma in "nessun contenuto", perché l'estrazione è best-effort.
   */
  extractContent(
    bytes: Uint8Array,
    mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<ExtractedContent>;
}

/**
 * Un pezzo del contenuto con un'identità stabile, a cui l'analisi potrà ancorare ciò che ricava (provenienza: pagina e
 * citazione). Audio e video (startMs, endMs, speaker) arrivano con l'MVP-2.
 */
export type ContentSegment =
  // `index`: numero di pagina reale, da 1 --- una pagina senza testo non fa scorrere la numerazione.
  | { id: string; kind: "page"; index: number; text: string }
  | { id: string; kind: "section"; title?: string; text: string };

/** Ispezione tecnica del file, locale e senza costo: distinta dai metadati semantici (emittente, scadenza...). */
export interface TechnicalMetadata {
  mimeType: string;
  sizeBytes: number;
  /** Pagine del documento (PDF). */
  pageCount?: number;
  /** Pagine di cui si è letto il testo: meno di `pageCount` se l'OCR si è fermato al tetto. */
  pagesRead?: number;
  /** Dimensioni in pixel (immagini). */
  width?: number;
  height?: number;
  /** Dal file stesso (PDF: dizionario Info; immagini: EXIF). Sono dichiarazioni del file, non verificate. */
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  /** Data di creazione/scatto, ISO 8601 (con ora se il file la dà). */
  createdAt?: string;
  cameraMake?: string;
  cameraModel?: string;
  /** Solo se c'è, non dove: la posizione non viene letta. */
  hasGpsLocation?: boolean;
}

export interface ExtractedContent {
  /** Uguale a ciò che oggi va in `extractedText` (normalizzato, tagliato al tetto della ricerca). */
  text: string | null;
  /** Codice ISO 639-1 (`it`, `en`...) se il testo è abbastanza per dirlo, altrimenti null. */
  language: string | null;
  segments: ContentSegment[];
  technical: TechnicalMetadata;
  extraction: {
    /** Identificativo stabile del motore (non il nome mostrato in UI). */
    extractor: string;
    version: string;
    /** Se una parte del testo viene dall'OCR. */
    ocr: boolean;
  };
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
  const collapsed = cleanExtractedText(raw);
  if (!collapsed) return null;
  return collapsed.length > MAX_EXTRACTED_CHARS ? collapsed.slice(0, MAX_EXTRACTED_CHARS) : collapsed;
}

/** Come normalizeExtractedText ma senza il tetto: per i segmenti, che l'analisi legge a blocchi e non con il limite della ricerca. */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    // Al massimo una riga vuota di separazione: scansioni e PDF producono spesso decine di a capo consecutivi.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
