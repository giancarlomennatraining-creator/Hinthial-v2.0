import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";

/** FASE 20: la cronologia, calcolata al volo sul testo già decifrato --- nessuna migrazione quando cambia la logica. */

export interface DossierTimelineEntry {
  document: DocumentListItem;
  /** Data letta nel documento (FASE 18) se c'è, altrimenti quella di caricamento --- solo come ripiego. */
  date: string;
  /** Se `date` viene dal documento (vera) o dal caricamento (di ripiego). */
  dateIsFromDocument: boolean;
}

/** In ordine cronologico --- dal più vecchio al più recente. */
export function buildDossierTimeline(documents: DocumentListItem[]): DossierTimelineEntry[] {
  const entries = documents.map((document) => {
    const documentDate = extractStructuredFields(document.extractedText).find(
      (field) => field.kind === "document-date",
    );
    return {
      document,
      date: documentDate ? documentDate.value : document.createdAt,
      dateIsFromDocument: Boolean(documentDate),
    };
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
