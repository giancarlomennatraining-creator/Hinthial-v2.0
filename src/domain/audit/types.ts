import type { AuditEventType } from "@/lib/audit/log-event";

export interface AuditEventListItem {
  id: string;
  type: AuditEventType;
  /** ISO. */
  createdAt: string;
}
