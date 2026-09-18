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

/** Normalizza gli spazi e taglia al tetto --- v. MAX_EXTRACTED_CHARS. */
export function normalizeExtractedText(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.length > MAX_EXTRACTED_CHARS ? collapsed.slice(0, MAX_EXTRACTED_CHARS) : collapsed;
}
