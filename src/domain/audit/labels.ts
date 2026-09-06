import type { AuditEventType } from "@/lib/audit/log-event";

export type AuditEventCategory = "access" | "content" | "contacts" | "security";

export const AUDIT_EVENT_TYPE_LABEL: Record<AuditEventType, string> = {
  login: "Accesso effettuato",
  logout: "Disconnessione",
  document_created: "Contenuto aggiunto all'archivio",
  document_deleted: "Contenuto eliminato dall'archivio",
  trusted_contact_added: "Contatto fiduciario aggiunto",
  vault_wiped: "Vault svuotato",
};

export const AUDIT_EVENT_TYPE_ICON: Record<AuditEventType, string> = {
  login: "🔓",
  logout: "🔒",
  document_created: "📄",
  document_deleted: "🗑️",
  trusted_contact_added: "🤝",
  vault_wiped: "⚠️",
};

export const AUDIT_EVENT_TYPE_CATEGORY: Record<AuditEventType, AuditEventCategory> = {
  login: "access",
  logout: "access",
  document_created: "content",
  document_deleted: "content",
  trusted_contact_added: "contacts",
  vault_wiped: "security",
};

export const AUDIT_EVENT_CATEGORY_LABEL: Record<AuditEventCategory, string> = {
  access: "Accessi",
  content: "Contenuti",
  contacts: "Contatti",
  security: "Sicurezza",
};

export const AUDIT_EVENT_CATEGORIES: AuditEventCategory[] = ["access", "content", "contacts", "security"];
