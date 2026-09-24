import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 20 --- la "cronologia" di un fascicolo: calcolata al volo sul
 * testo già decifrato in memoria (come i campi estratti della FASE 18),
 * non salvata. Nessuna migrazione quando cambia la logica, vale da
 * subito su tutto l'archivio esistente.
 *
 * (Il "totale delle spese", che viveva qui, è stato rimosso su
 * richiesta esplicita insieme al concetto di importo --- v.
 * CHANGELOG.md e domain/extraction/structured-fields.ts.)
 */

export interface DossierTimelineEntry {
  document: DocumentListItem;
  /**
   * La data usata per ordinare: quella che Hinthial ha letto nel
   * documento (FASE 18) se c'è, altrimenti quella di caricamento. Un
   * fascicolo è una storia raccontata nel tempo --- ordinarla per data di
   * caricamento va bene solo quando non si sa altro.
   */
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
