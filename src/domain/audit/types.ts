import type { AuditEntityType, AuditEventMetadata, AuditEventType } from "@/lib/audit/log-event";

export interface AuditEventListItem {
  id: string;
  type: AuditEventType;
  /** ISO. */
  createdAt: string;
  metadata: AuditEventMetadata | null;
  /** L'item a cui l'evento è agganciato; null per gli eventi di sistema. */
  entityType: AuditEntityType | null;
  entityId: string | null;
  /** Titolo cifrato dell'item, solo negli eventi di eliminazione definitiva. */
  encryptedLabel: string | null;
}

/** Criteri di interrogazione del registro --- v. AuditLogPanel. */
export interface AuditEventQuery {
  /** ISO (yyyy-mm-dd), incluso. */
  startDate: string | null;
  /** ISO (yyyy-mm-dd), incluso. */
  endDate: string | null;
  /** Nessun tipo = nessun filtro (tutti). */
  types: AuditEventType[];
  /** Solo gli eventi di un item. */
  entity: { type: AuditEntityType; id: string } | null;
  /** 1-based. */
  page: number;
  pageSize: number;
}

export interface AuditEventPage {
  events: AuditEventListItem[];
  /** Eventi che corrispondono ai filtri, su tutte le pagine. */
  total: number;
}
