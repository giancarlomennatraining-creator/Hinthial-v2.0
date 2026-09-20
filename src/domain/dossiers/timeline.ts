import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 20 --- la "cronologia" di un fascicolo, e il "totale delle
 * spese": due funzioni pure, calcolate al volo sul testo già decifrato
 * in memoria (come i campi estratti della FASE 18), non salvate. Stesso
 * motivo di allora: nessuna migrazione quando cambia la logica, valgono
 * da subito su tutto l'archivio esistente.
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

/**
 * La somma degli importi che Hinthial ha riconosciuto nei documenti del
 * fascicolo (v. FASE 18, un solo importo per documento --- lo stesso
 * filtro restrittivo che evita di scambiare un valore di laboratorio per
 * un importo).
 *
 * `null` quando nessun documento ne ha uno --- non "0": un fascicolo
 * senza importi riconosciuti non è un fascicolo che è costato zero, è
 * un fascicolo di cui non si sa quanto sia costato. Mostrare "€0,00"
 * sarebbe un dato falso con l'aria di saperlo, esattamente ciò che la
 * FASE 18 evita di proposito altrove.
 *
 * Somma in centesimi (interi) e non in virgola mobile: gli importi sono
 * sempre stringhe con due decimali esatti (v. structured-fields.ts,
 * parseItalianAmount), e un totale che sbaglia il centesimo per un
 * arrotondamento di virgola mobile sarebbe peggio di non calcolarlo.
 */
export function dossierTotalAmount(documents: DocumentListItem[]): string | null {
  let totalCents = 0;
  let found = false;

  for (const document of documents) {
    const amount = extractStructuredFields(document.extractedText).find(
      (field) => field.kind === "amount",
    );
    if (!amount) continue;

    found = true;
    const [whole, cents] = amount.value.split(".");
    totalCents += Number(whole) * 100 + Number(cents ?? "0");
  }

  if (!found) return null;
  return `${Math.floor(totalCents / 100)}.${String(totalCents % 100).padStart(2, "0")}`;
}
