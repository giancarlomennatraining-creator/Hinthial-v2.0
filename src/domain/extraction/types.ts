/**
 * FASE 17 --- lettura del contenuto di un elemento d'Archivio per
 * ricavarne testo cercabile, **interamente sul dispositivo**: il testo
 * viene estratto prima della cifratura e salvato cifrato come tutto il
 * resto (v. domain/documents/repository.ts, uploadDocument). Nessun
 * byte lascia il browser, quindi non serve alcun consenso: è la
 * differenza tra "leggere" e "far leggere a qualcun altro".
 *
 * Stesso schema a provider già usato da Categorizer (v.
 * domain/categorizer), TranscriptionProvider (v. domain/transcription) e
 * AIProvider (v. domain/ai): un'interfaccia stabile, implementazioni
 * sostituibili, chi chiama non cambia. Oggi PDF (pdf.js) e immagini
 * (OCR); la trascrizione audio/video si aggiungerà qui senza toccare i
 * chiamanti.
 */
export interface TextExtractor {
  /** Mostrato in UI/log quando è utile sapere quale motore ha risposto. */
  readonly name: string;
  /** I tipi MIME che questo motore sa leggere. */
  supports(mimeType: string): boolean;
  /**
   * Il testo trovato, oppure null se non c'è nulla da estrarre --- un
   * PDF fatto di sole scansioni, per esempio, non ha testo finché non
   * arriva l'OCR. Non deve mai lanciare: chi chiama tratta
   * l'estrazione come best-effort e salva comunque il contenuto.
   */
  extract(
    bytes: Uint8Array,
    mimeType: string,
    onProgress?: ExtractionProgress,
  ): Promise<string | null>;
}

/**
 * Avanzamento da 0 a 1, per i motori che ci mettono abbastanza da
 * doverlo dire. L'OCR di una foto richiede secondi, non millisecondi: un
 * pulsante fermo su "Sto leggendo…" per venti secondi è indistinguibile
 * da uno bloccato (v. FASE 17c). Opzionale: chi non ha modo di stimare
 * l'avanzamento semplicemente non chiama.
 */
export type ExtractionProgress = (fraction: number) => void;

/**
 * Tetto al testo salvato per un singolo contenuto. Un PDF di mille
 * pagine produrrebbe megabyte di testo che verrebbero cifrati,
 * trasferiti e poi ri-decifrati a ogni caricamento dell'elenco --- per
 * cercarci dentro, i primi ~200.000 caratteri bastano ampiamente
 * (circa 60-80 pagine di testo fitto).
 */
export const MAX_EXTRACTED_CHARS = 200_000;

/**
 * Ripulisce il testo estratto e lo taglia al tetto (v.
 * MAX_EXTRACTED_CHARS), **conservando gli a capo**.
 *
 * Fino alla FASE 17d ogni spazio bianco --- a capo compresi --- veniva
 * schiacciato in uno spazio solo. Per cercare andava benissimo: la
 * ricerca non guarda l'impaginazione. Ma dal momento in cui questo testo
 * si mostra all'utente (FASE 17e, la pagina di dettaglio), un referto di
 * tre pagine diventava un unico paragrafo da ottomila caratteri: tecnicamente
 * corretto e illeggibile.
 *
 * Quindi: spazi compattati **dentro** la riga, righe vuote di troppo
 * ridotte a una sola, struttura preservata. Chi cerca non se ne accorge
 * --- la ricerca appiattisce per conto suo (v. lib/text-snippet.ts,
 * flattenForSearch), altrimenti una frase a cavallo di due righe non si
 * troverebbe più.
 */
export function normalizeExtractedText(raw: string): string | null {
  const collapsed = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    // Al massimo una riga vuota di separazione: le scansioni e i PDF
    // producono spesso decine di a capo consecutivi.
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!collapsed) return null;
  return collapsed.length > MAX_EXTRACTED_CHARS ? collapsed.slice(0, MAX_EXTRACTED_CHARS) : collapsed;
}
