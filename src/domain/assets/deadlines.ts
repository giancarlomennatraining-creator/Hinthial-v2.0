import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * Tutte le scadenze di un bene in un posto solo: le scadenze create apposta per il bene, quelle dei suoi documenti
 * (un evento accettato da una polizza è collegato al documento, non al bene) e la data di scadenza dei documenti
 * stessi. Prima il bene mostrava solo le prime e le altre restavano nascoste nei singoli documenti.
 */
export interface AssetDeadline {
  /** "reminder" = una scadenza in Scadenze; "document" = la data di scadenza scritta sul documento. */
  kind: "reminder" | "document";
  id: string;
  title: string;
  /** ISO: una data (`YYYY-MM-DD`) per un documento, un istante per una scadenza. */
  date: string;
}

export function assetDeadlines(
  assetId: string,
  documents: Pick<DocumentSummary, "id" | "filename" | "relatedAssetId" | "expiresAt">[],
  reminders: Pick<ReminderListItem, "id" | "title" | "dueAt" | "completed" | "relatedDocumentId" | "relatedAssetId">[],
): AssetDeadline[] {
  const linkedDocuments = documents.filter((d) => d.relatedAssetId === assetId);
  const documentIds = new Set(linkedDocuments.map((d) => d.id));

  const fromReminders: AssetDeadline[] = reminders
    .filter(
      (r) => !r.completed && (r.relatedAssetId === assetId || (r.relatedDocumentId !== null && documentIds.has(r.relatedDocumentId))),
    )
    .map((r) => ({ kind: "reminder", id: r.id, title: r.title, date: r.dueAt }));

  // Se la scadenza del documento è già una scadenza in Scadenze (stesso giorno, stesso documento: succede con un
  // pagamento accettato come evento), si mostra solo quella, che ha un titolo più chiaro.
  const dayOf = (iso: string) => iso.slice(0, 10);
  const covered = new Set(
    reminders
      .filter((r) => r.relatedDocumentId !== null && documentIds.has(r.relatedDocumentId))
      .map((r) => `${r.relatedDocumentId}:${dayOf(r.dueAt)}`),
  );

  const fromDocuments: AssetDeadline[] = linkedDocuments
    .filter((d) => d.expiresAt && !covered.has(`${d.id}:${dayOf(d.expiresAt)}`))
    .map((d) => ({ kind: "document", id: d.id, title: `${d.filename} scade`, date: d.expiresAt as string }));

  return [...fromReminders, ...fromDocuments].sort((a, b) => a.date.localeCompare(b.date));
}
