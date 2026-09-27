import { canExtractText } from "@/domain/extraction/extract-text";
import { contentKindFor } from "@/lib/content-kind";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 17e: in che rapporto sta Hinthial col contenuto --- `own-text` è già testo (nota); `cannot` non sa ancora
 * leggere il tipo; `never` saprebbe ma non ci ha mai provato (pre-FASE 17); `nothing` ci ha provato senza trovare
 * nulla; `text` ci ha provato e trovato.
 */
export type ReadingState = "own-text" | "cannot" | "never" | "nothing" | "text";

export function readingStateFor(
  doc: Pick<DocumentListItem, "mimeType" | "extractedText" | "extractedAt">,
): ReadingState {
  if (contentKindFor(doc.mimeType) === "note") return "own-text";
  if (!canExtractText(doc.mimeType)) return "cannot";
  if (doc.extractedAt === null) return "never";
  return doc.extractedText.trim() ? "text" : "nothing";
}
