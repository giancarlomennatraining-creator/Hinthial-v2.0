import { cleanExtractedText, type ContentSegment } from "@/domain/extraction/types";
import type { AnalysisBlock, AnalysisSegment } from "@/domain/ai/analysis/types";

/** Una richiesta al modello porta al massimo questo testo (marcatori compresi): abbastanza piccola da stare in una risposta strutturata. */
export const MAX_BLOCK_CHARS = 12_000;
/** Oltre questo numero di blocchi il documento si legge solo in parte (e lo si dice): tetto di costo per documento. */
export const MAX_BLOCKS_PER_DOCUMENT = 20;
/** Lunghezza a cui si tagliano le sezioni ricavate dal solo testo: abbastanza fini da dare una provenienza utile. */
const SECTION_TARGET_CHARS = 3_000;

export interface PreparedAnalysis {
  /** I segmenti effettivamente inviati: contro questi si verifica ogni citazione. */
  segments: AnalysisSegment[];
  blocks: AnalysisBlock[];
  /** Quanti blocchi servirebbero per leggere tutto, prima del tetto. */
  blocksTotal: number;
  /** True se il tetto per documento ha lasciato fuori una parte. */
  truncated: boolean;
}

function marker(id: string): string {
  return `[[${id}]]`;
}

/** Taglia su confini di paragrafo, poi di spazio; un pezzo non supera `maxChars`. */
export function chunkText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of text.split(/\n{2,}/)) {
    let rest = paragraph;
    while (rest.length > maxChars) {
      const cut = rest.lastIndexOf(" ", maxChars);
      const at = cut > maxChars / 2 ? cut : maxChars;
      flush();
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at);
    }
    if (current && current.length + 2 + rest.length > maxChars) flush();
    current = current ? `${current}\n\n${rest}` : rest;
  }
  flush();

  return chunks.filter(Boolean);
}

/** I segmenti letti sul dispositivo, nella forma dell'analisi; una pagina troppo lunga si divide in parti con lo stesso numero di pagina. */
export function segmentsFromContent(segments: ContentSegment[]): AnalysisSegment[] {
  const result: AnalysisSegment[] = [];
  for (const segment of segments) {
    const text = cleanExtractedText(segment.text);
    if (!text) continue;
    const page = segment.kind === "page" ? segment.index : null;
    const budget = MAX_BLOCK_CHARS - marker(segment.id).length - 8;
    const parts = chunkText(text, budget);
    parts.forEach((part, index) => {
      result.push({ id: parts.length > 1 ? `${segment.id}.${index + 1}` : segment.id, page, text: part });
    });
  }
  return result;
}

/** Senza segmenti salvati (documenti letti prima della PR1) il testo si divide in sezioni: la provenienza sarà la sezione, non la pagina. */
export function segmentsFromText(text: string): AnalysisSegment[] {
  return chunkText(cleanExtractedText(text), SECTION_TARGET_CHARS).map((part, index) => ({
    id: `s${index + 1}`,
    page: null,
    text: part,
  }));
}

function formatSegment(segment: AnalysisSegment): string {
  return `${marker(segment.id)}\n${segment.text}`;
}

/** Impacchetta i segmenti in blocchi consecutivi, rispettando i tetti per blocco e per documento. */
export function prepareAnalysis(input: { segments?: ContentSegment[] | null; text: string | null }): PreparedAnalysis {
  const segments =
    input.segments && input.segments.length > 0
      ? segmentsFromContent(input.segments)
      : input.text
        ? segmentsFromText(input.text)
        : [];

  const grouped: AnalysisSegment[][] = [];
  let current: AnalysisSegment[] = [];
  let currentLength = 0;
  for (const segment of segments) {
    const length = formatSegment(segment).length + 2;
    if (current.length > 0 && currentLength + length > MAX_BLOCK_CHARS) {
      grouped.push(current);
      current = [];
      currentLength = 0;
    }
    current.push(segment);
    currentLength += length;
  }
  if (current.length > 0) grouped.push(current);

  const kept = grouped.slice(0, MAX_BLOCKS_PER_DOCUMENT);
  const blocks: AnalysisBlock[] = kept.map((group, index) => ({
    id: `b${index + 1}`,
    segmentIds: group.map((s) => s.id),
    text: group.map(formatSegment).join("\n\n"),
  }));

  return {
    segments: kept.flat(),
    blocks,
    blocksTotal: grouped.length,
    truncated: grouped.length > kept.length,
  };
}
