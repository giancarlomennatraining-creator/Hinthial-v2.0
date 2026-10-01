import type { AuditEventListItem } from "@/domain/audit/types";

/** Una lettura di Hinthia genera un evento per blocco: per chi guarda la cronologia è un'azione sola. */
const COLLAPSE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Cronologia di un documento, dal più recente: le letture di Hinthia ravvicinate diventano una riga sola e il
 * risultato è limitato a `max` righe. `events` arriva già ordinato dal più recente.
 */
export function summarizeDocumentHistory(events: AuditEventListItem[], max: number): AuditEventListItem[] {
  const result: AuditEventListItem[] = [];
  for (const event of events) {
    const previous = result[result.length - 1];
    if (
      previous &&
      previous.type === "ai_extraction_used" &&
      event.type === "ai_extraction_used" &&
      Date.parse(previous.createdAt) - Date.parse(event.createdAt) <= COLLAPSE_WINDOW_MS
    ) {
      continue;
    }
    result.push(event);
  }
  return result.slice(0, max);
}
