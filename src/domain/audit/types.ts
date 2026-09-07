import type { AuditEventMetadata, AuditEventType } from "@/lib/audit/log-event";

export interface AuditEventListItem {
  id: string;
  type: AuditEventType;
  /** ISO. */
  createdAt: string;
  metadata: AuditEventMetadata | null;
}

/** Criteri di interrogazione del registro --- v. AuditLogPanel ("Trova"). */
export interface AuditEventQuery {
  /** ISO (yyyy-mm-dd), incluso. */
  startDate: string | null;
  /** ISO (yyyy-mm-dd), incluso. */
  endDate: string | null;
  /** Nessun tipo selezionato = nessun filtro (tutti). */
  types: AuditEventType[];
}
