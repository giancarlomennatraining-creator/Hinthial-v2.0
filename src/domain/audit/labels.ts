import type { AuditEventType } from "@/lib/audit/log-event";

export type AuditEventCategory = "access" | "content" | "contacts" | "security";

export const AUDIT_EVENT_TYPE_LABEL: Record<AuditEventType, string> = {
  login: "Accesso effettuato",
  logout: "Disconnessione",
  login_failed: "Tentativo di accesso fallito",
  mfa_challenge_failed: "Verifica a due fattori fallita",
  mfa_enrolled: "Autenticazione a due fattori attivata",
  mfa_removed: "Dispositivo di autenticazione rimosso",
  backup_codes_generated: "Codici di backup generati",
  document_created: "Contenuto aggiunto all'archivio",
  document_deleted: "Contenuto eliminato dall'archivio",
  asset_created: "Bene aggiunto",
  asset_deleted: "Bene eliminato",
  capsule_created: "Capsula creata",
  capsule_deleted: "Capsula eliminata",
  category_created: "Categoria creata",
  category_deleted: "Categoria eliminata",
  trusted_contact_added: "Contatto fiduciario aggiunto",
  vault_wiped: "Vault svuotato",
  ai_chat_used: "Domanda inviata all'assistente AI reale",
};

export const AUDIT_EVENT_TYPE_ICON: Record<AuditEventType, string> = {
  login: "🔓",
  logout: "🔒",
  login_failed: "🚫",
  mfa_challenge_failed: "⚠️",
  mfa_enrolled: "🔐",
  mfa_removed: "🔓",
  backup_codes_generated: "🔑",
  document_created: "📄",
  document_deleted: "🗑️",
  asset_created: "💼",
  asset_deleted: "🗑️",
  capsule_created: "⏳",
  capsule_deleted: "🗑️",
  category_created: "🏷️",
  category_deleted: "🗑️",
  trusted_contact_added: "🤝",
  vault_wiped: "⚠️",
  ai_chat_used: "🤖",
};

export const AUDIT_EVENT_TYPE_CATEGORY: Record<AuditEventType, AuditEventCategory> = {
  login: "access",
  logout: "access",
  login_failed: "access",
  mfa_challenge_failed: "security",
  mfa_enrolled: "security",
  mfa_removed: "security",
  backup_codes_generated: "security",
  document_created: "content",
  document_deleted: "content",
  asset_created: "content",
  asset_deleted: "content",
  capsule_created: "content",
  capsule_deleted: "content",
  category_created: "content",
  category_deleted: "content",
  trusted_contact_added: "contacts",
  vault_wiped: "security",
  ai_chat_used: "security",
};

export const AUDIT_EVENT_CATEGORY_LABEL: Record<AuditEventCategory, string> = {
  access: "Accessi",
  content: "Contenuti",
  contacts: "Contatti",
  security: "Sicurezza",
};

export const AUDIT_EVENT_CATEGORIES: AuditEventCategory[] = ["access", "content", "contacts", "security"];
