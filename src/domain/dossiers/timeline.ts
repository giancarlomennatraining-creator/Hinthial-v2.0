import type { DocumentSummary } from "@/domain/documents/types";

/** FASE 20: la cronologia di un fascicolo, calcolata al volo --- nessuna migrazione quando cambia la logica. */

export interface DossierTimelineEntry<D extends Pick<DocumentSummary, "createdAt"> = DocumentSummary> {
  document: D;
  /** La data di caricamento del documento. */
  date: string;
}

/** In ordine cronologico --- dal più vecchio al più recente. */
export function buildDossierTimeline<D extends Pick<DocumentSummary, "createdAt">>(
  documents: D[],
): DossierTimelineEntry<D>[] {
  return documents
    .map((document) => ({ document, date: document.createdAt }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
