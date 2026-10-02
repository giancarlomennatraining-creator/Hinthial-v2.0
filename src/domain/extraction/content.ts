import { detectLanguage } from "@/domain/extraction/language";
import {
  cleanExtractedText,
  normalizeExtractedText,
  type ContentSegment,
  type ExtractedContent,
  type TechnicalMetadata,
} from "@/domain/extraction/types";

export interface ReadPage {
  /** Numero di pagina reale, da 1. */
  index: number;
  /** Testo grezzo come l'ha dato il motore: lo ripulisce buildExtractedContent. */
  text: string;
}

/**
 * Compone il risultato di un motore a partire dal testo letto pagina per pagina. `text` è esattamente ciò che prima
 * produceva l'estrazione (le pagine unite da una riga vuota, poi normalizzate e tagliate al tetto della ricerca): i
 * segmenti sono la stessa materia, non tagliata e con il numero di pagina. Le pagine senza testo non diventano segmenti.
 */
export function buildExtractedContent(input: {
  pages: ReadPage[];
  technical: TechnicalMetadata;
  extraction: ExtractedContent["extraction"];
}): ExtractedContent {
  const segments: ContentSegment[] = [];
  for (const page of input.pages) {
    const text = cleanExtractedText(page.text);
    if (text) segments.push({ id: `p${page.index}`, kind: "page", index: page.index, text });
  }

  const text = normalizeExtractedText(segments.map((segment) => segment.text).join("\n\n"));

  return {
    text,
    language: text ? detectLanguage(text) : null,
    segments,
    technical: input.technical,
    extraction: input.extraction,
  };
}
