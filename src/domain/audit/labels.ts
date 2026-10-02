import type { AuditEntityType, AuditEventMetadata, AuditEventType } from "@/lib/audit/log-event";

/** Le aree del registro: raggruppano i tipi di evento nel filtro di Impostazioni > Attività. */
export type AuditEventCategory =
  | "access"
  | "security"
  | "archive"
  | "assets"
  | "capsules"
  | "friends"
  | "digital-legacy"
  | "hinthia";

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
  asset_updated: "Bene modificato",
  asset_deleted: "Bene eliminato",
  capsule_created: "Capsula creata",
  capsule_updated: "Capsula modificata",
  capsule_deleted: "Capsula eliminata",
  category_created: "Categoria creata",
  category_updated: "Categoria modificata",
  category_deleted: "Categoria eliminata",
  friend_added: "Amico aggiunto",
  friend_updated: "Amico modificato",
  friend_deleted: "Amico eliminato",
  vault_wiped: "Vault svuotato",
  ai_chat_used: "Domanda inviata a Hinthia",
  ai_extraction_used: "Documento letto da Hinthia",
  trusted_device_registered: "Dispositivo fidato registrato",
  trusted_device_revoked: "Dispositivo fidato revocato",
  digital_legacy_reminder_sent: "Promemoria di inattività inviato",
  digital_legacy_grace_period_started: "Periodo di grazia iniziato",
  digital_legacy_awaiting_guardians: "Periodo di grazia scaduto, in attesa",
  digital_legacy_reset: "Eredità digitale annullata (accesso rilevato)",
  digital_legacy_guardian_requested: "Verifica richiesta a un guardiano",
  digital_legacy_guardian_responded: "Un guardiano ha risposto",
  digital_legacy_guardians_confirmed: "Guardiani: irraggiungibilità confermata",
  digital_legacy_reset_by_guardian: "Eredità digitale annullata (un guardiano ha confermato che va tutto bene)",
  digital_legacy_formal_verification_started: "Verifica formale iniziata",
  digital_legacy_final_wait_started: "Attesa finale iniziata",
  digital_legacy_triggered: "Eredità digitale attivata: capsule aperte ai destinatari",
  friend_request_sent: "Richiesta di amicizia inviata",
  friend_request_accepted: "Richiesta di amicizia accettata",
  friend_request_rejected: "Richiesta di amicizia rifiutata",
  guardian_role_requested: "Richiesta di diventare guardiano inviata",
  guardian_role_accepted: "Richiesta di diventare guardiano accettata",
  guardian_role_rejected: "Richiesta di diventare guardiano rifiutata",
  guardian_role_revoked: "Guardiano rimosso",
  guardian_role_resigned: "Dimissioni da guardiano",
  proposal_accepted: "Proposta accettata",
  proposal_rejected: "Proposta rifiutata",
  proposal_undone: "Proposta annullata",
  dossier_created: "Fascicolo creato",
  dossier_updated: "Fascicolo modificato",
  dossier_deleted: "Fascicolo eliminato",
  document_trashed: "Contenuto spostato nel cestino",
  document_restored: "Contenuto ripristinato dal cestino",
  document_purged: "Contenuto eliminato per sempre",
  document_updated: "Contenuto modificato",
  document_downloaded: "Contenuto scaricato",
  document_text_read: "Testo letto sul dispositivo",
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
  asset_updated: "✏️",
  asset_deleted: "🗑️",
  capsule_created: "⏳",
  capsule_updated: "✏️",
  capsule_deleted: "🗑️",
  category_created: "🏷️",
  category_updated: "✏️",
  category_deleted: "🗑️",
  friend_added: "🤝",
  friend_updated: "✏️",
  friend_deleted: "🗑️",
  vault_wiped: "⚠️",
  ai_chat_used: "🤖",
  ai_extraction_used: "🔒",
  trusted_device_registered: "📱",
  trusted_device_revoked: "🚫",
  digital_legacy_reminder_sent: "💌",
  digital_legacy_grace_period_started: "⏳",
  digital_legacy_awaiting_guardians: "⏸️",
  digital_legacy_reset: "✅",
  digital_legacy_guardian_requested: "🛡️",
  digital_legacy_guardian_responded: "💬",
  digital_legacy_guardians_confirmed: "🚨",
  digital_legacy_reset_by_guardian: "✅",
  digital_legacy_formal_verification_started: "🔍",
  digital_legacy_final_wait_started: "⏳",
  digital_legacy_triggered: "🔓",
  friend_request_sent: "🤝",
  friend_request_accepted: "🤝",
  friend_request_rejected: "🙅",
  guardian_role_requested: "🛡️",
  guardian_role_accepted: "🛡️",
  guardian_role_rejected: "🙅",
  guardian_role_revoked: "🛡️",
  guardian_role_resigned: "🛡️",
  proposal_accepted: "✨",
  proposal_rejected: "🙅",
  proposal_undone: "↩️",
  dossier_created: "🗂️",
  dossier_updated: "✏️",
  dossier_deleted: "🗑️",
  document_trashed: "🗑️",
  document_restored: "♻️",
  document_purged: "🔥",
  document_updated: "✏️",
  document_downloaded: "⬇️",
  document_text_read: "👁️",
};

export const AUDIT_EVENT_TYPE_CATEGORY: Record<AuditEventType, AuditEventCategory> = {
  login: "access",
  logout: "access",
  login_failed: "access",
  mfa_challenge_failed: "security",
  mfa_enrolled: "security",
  mfa_removed: "security",
  backup_codes_generated: "security",
  vault_wiped: "security",
  trusted_device_registered: "security",
  trusted_device_revoked: "security",
  document_created: "archive",
  document_deleted: "archive",
  document_trashed: "archive",
  document_restored: "archive",
  document_purged: "archive",
  document_updated: "archive",
  document_downloaded: "archive",
  document_text_read: "archive",
  proposal_accepted: "archive",
  proposal_rejected: "archive",
  proposal_undone: "archive",
  dossier_created: "archive",
  dossier_updated: "archive",
  dossier_deleted: "archive",
  category_created: "archive",
  category_updated: "archive",
  category_deleted: "archive",
  asset_created: "assets",
  asset_updated: "assets",
  asset_deleted: "assets",
  capsule_created: "capsules",
  capsule_updated: "capsules",
  capsule_deleted: "capsules",
  friend_added: "friends",
  friend_updated: "friends",
  friend_deleted: "friends",
  friend_request_sent: "friends",
  friend_request_accepted: "friends",
  friend_request_rejected: "friends",
  guardian_role_requested: "friends",
  guardian_role_accepted: "friends",
  guardian_role_rejected: "friends",
  guardian_role_revoked: "friends",
  guardian_role_resigned: "friends",
  digital_legacy_reminder_sent: "digital-legacy",
  digital_legacy_grace_period_started: "digital-legacy",
  digital_legacy_awaiting_guardians: "digital-legacy",
  digital_legacy_reset: "digital-legacy",
  digital_legacy_guardian_requested: "digital-legacy",
  digital_legacy_guardian_responded: "digital-legacy",
  digital_legacy_guardians_confirmed: "digital-legacy",
  digital_legacy_reset_by_guardian: "digital-legacy",
  digital_legacy_formal_verification_started: "digital-legacy",
  digital_legacy_final_wait_started: "digital-legacy",
  digital_legacy_triggered: "digital-legacy",
  ai_chat_used: "hinthia",
  ai_extraction_used: "hinthia",
};

export const AUDIT_EVENT_CATEGORY_LABEL: Record<AuditEventCategory, string> = {
  access: "Accessi",
  security: "Sicurezza",
  archive: "Archivio",
  assets: "Beni",
  capsules: "Capsule",
  friends: "Amici",
  "digital-legacy": "Eredità digitale",
  hinthia: "Hinthia",
};

export const AUDIT_EVENT_CATEGORIES: AuditEventCategory[] = [
  "access",
  "security",
  "archive",
  "assets",
  "capsules",
  "friends",
  "digital-legacy",
  "hinthia",
];

export const AUDIT_ENTITY_TYPE_LABEL: Record<AuditEntityType, string> = {
  document: "Contenuto",
  asset: "Bene",
  friend: "Amico",
  capsule: "Capsula",
  dossier: "Fascicolo",
  category: "Categoria",
};

/** Tutti i tipi di evento di un'area, nell'ordine delle etichette. */
export function auditEventTypesOf(category: AuditEventCategory): AuditEventType[] {
  return (Object.keys(AUDIT_EVENT_TYPE_CATEGORY) as AuditEventType[]).filter(
    (type) => AUDIT_EVENT_TYPE_CATEGORY[type] === category,
  );
}

const DOCUMENT_CHANGE_LABEL = {
  details: "Dettagli",
  note: "Testo della nota",
  transcript: "Trascrizione",
  ai_exclusion: "Esclusione da Hinthia",
  ai_reading: "Lettura di Hinthia salvata",
} as const;

const PROPOSAL_KIND_LABEL = {
  expiry: "Scadenza",
  category: "Categoria",
  issuer: "Emittente",
  event: "Evento verso Scadenze",
} as const;

/**
 * Etichetta di un evento così com'è stato registrato: la lettura di Hinthia distingue "letto" da "riletto", le
 * proposte dicono su quale campo. `fieldLabels` traduce le chiavi dei campi liberi nelle etichette del vocabolario
 * (senza, si mostra la chiave). Mai valori: nei metadati non ce ne sono.
 */
export function describeAuditEvent(
  event: { type: AuditEventType; metadata: AuditEventMetadata | null },
  fieldLabels?: Record<string, string>,
): { label: string; detail: string | null } {
  const metadata = event.metadata;
  if (event.type === "ai_extraction_used" && metadata?.reread) {
    return { label: "Documento riletto da Hinthia", detail: null };
  }
  if (event.type === "document_text_read" && metadata?.reread) {
    return { label: "Testo riletto sul dispositivo", detail: null };
  }
  if (event.type === "document_updated" && metadata?.change) {
    const base = AUDIT_EVENT_TYPE_LABEL.document_updated;
    if (metadata.change === "ai_exclusion") {
      return { label: base, detail: `${DOCUMENT_CHANGE_LABEL.ai_exclusion}: ${metadata.excluded ? "escluso" : "riammesso"}` };
    }
    return { label: base, detail: DOCUMENT_CHANGE_LABEL[metadata.change] };
  }
  if (
    (event.type === "proposal_accepted" ||
      event.type === "proposal_rejected" ||
      event.type === "proposal_undone") &&
    metadata?.proposalKind
  ) {
    const detail =
      metadata.proposalKind === "field"
        ? metadata.fieldKey
          ? (fieldLabels?.[metadata.fieldKey] ?? metadata.fieldKey)
          : "Campo"
        : PROPOSAL_KIND_LABEL[metadata.proposalKind];
    return { label: AUDIT_EVENT_TYPE_LABEL[event.type], detail };
  }
  return { label: AUDIT_EVENT_TYPE_LABEL[event.type], detail: null };
}
