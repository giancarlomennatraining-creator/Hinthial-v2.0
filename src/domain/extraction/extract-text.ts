import { ocrTextExtractor } from "@/domain/extraction/ocr-extractor";
import { pdfTextExtractor } from "@/domain/extraction/pdf-extractor";
import type { ExtractedContent, ExtractionProgress, TextExtractor } from "@/domain/extraction/types";

/**
 * I motori disponibili, in ordine di verifica. La trascrizione
 * (audio/video) si aggiunge qui nel passo successivo della FASE 17,
 * senza toccare chi chiama.
 */
const EXTRACTORS: TextExtractor[] = [pdfTextExtractor, ocrTextExtractor];

/** Se esiste un motore capace di leggere questo tipo di contenuto. */
export function canExtractText(mimeType: string): boolean {
  return EXTRACTORS.some((extractor) => extractor.supports(mimeType));
}

/**
 * Il contenuto letto (testo, segmenti per pagina, ispezione tecnica), o
 * null se il tipo non ha un motore o se la lettura fallisce.
 *
 * **Non lancia mai**, di proposito: l'estrazione è un di più: un PDF
 * malformato, un worker che non parte o un file protetto da password
 * non devono impedire di salvare il documento. Nel peggiore dei casi si
 * perde la ricerca dentro quel file, non il file.
 */
export async function extractContent(
  bytes: Uint8Array,
  mimeType: string,
  onProgress?: ExtractionProgress,
): Promise<ExtractedContent | null> {
  const extractor = EXTRACTORS.find((candidate) => candidate.supports(mimeType));
  if (!extractor) return null;

  try {
    return await extractor.extractContent(bytes, mimeType, onProgress);
  } catch (error) {
    console.warn(`[extraction] ${extractor.name} non è riuscito a leggere il contenuto:`, error);
    return null;
  }
}

/** Solo il testo (ciò che va in `extractedText`), o null se non c'è nulla da estrarre. Non lancia mai. */
export async function extractText(
  bytes: Uint8Array,
  mimeType: string,
  onProgress?: ExtractionProgress,
): Promise<string | null> {
  return (await extractContent(bytes, mimeType, onProgress))?.text ?? null;
}
