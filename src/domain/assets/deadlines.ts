import { mergeDeadlines, type Deadline } from "@/domain/deadlines";
import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * Tutte le scadenze di un bene in un posto solo: le scadenze create apposta per il bene, quelle dei suoi documenti
 * (un evento accettato da una polizza è collegato al documento, non al bene) e la data di scadenza dei documenti
 * stessi. Prima il bene mostrava solo le prime e le altre restavano nascoste nei singoli documenti. Le regole di
 * unione sono quelle di tutte le scadenze (v. domain/deadlines).
 */
export type AssetDeadline = Deadline;

export function assetDeadlines(
  assetId: string,
  documents: Pick<DocumentSummary, "id" | "filename" | "relatedAssetId" | "expiresAt">[],
  reminders: Pick<ReminderListItem, "id" | "title" | "dueAt" | "completed" | "relatedDocumentId" | "relatedAssetId">[],
): AssetDeadline[] {
  const linkedDocuments = documents.filter((d) => d.relatedAssetId === assetId);
  const documentIds = new Set(linkedDocuments.map((d) => d.id));
  const mine = reminders.filter(
    (r) => r.relatedAssetId === assetId || (r.relatedDocumentId !== null && documentIds.has(r.relatedDocumentId)),
  );
  return mergeDeadlines(linkedDocuments, mine);
}
