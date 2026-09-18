import { pdfTextExtractor } from "@/domain/extraction/pdf-extractor";
import type { TextExtractor } from "@/domain/extraction/types";

/**
 * I motori disponibili, in ordine di verifica. Oggi solo il PDF ---
 * OCR (immagini) e trascrizione (audio/video) si aggiungono qui nei
 * passi successivi della FASE 17, senza toccare chi chiama.
 */
const EXTRACTORS: TextExtractor[] = [pdfTextExtractor];

/** Se esiste un motore capace di leggere questo tipo di contenuto. */
export function canExtractText(mimeType: string): boolean {
  return EXTRACTORS.some((extractor) => extractor.supports(mimeType));
}

/**
 * Il testo del contenuto, o null se non c'è nulla da estrarre o se
 * l'estrazione fallisce.
 *
 * **Non lancia mai**, di proposito: l'estrazione è un di più: un PDF
 * malformato, un worker che non parte o un file protetto da password
 * non devono impedire di salvare il documento. Nel peggiore dei casi si
 * perde la ricerca dentro quel file, non il file.
 */
export async function extractText(bytes: Uint8Array, mimeType: string): Promise<string | null> {
  const extractor = EXTRACTORS.find((candidate) => candidate.supports(mimeType));
  if (!extractor) return null;

  try {
    return await extractor.extract(bytes, mimeType);
  } catch (error) {
    console.warn(`[extraction] ${extractor.name} non è riuscito a leggere il contenuto:`, error);
    return null;
  }
}
