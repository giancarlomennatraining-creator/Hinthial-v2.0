import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

/** Event types recordable. Validated here, not by a DB check constraint (v. migrazione 20261003): a new type needs no migration. */
export type AuditEventType =
  | "login"
  | "logout"
  | "login_failed"
  | "mfa_challenge_failed"
  | "mfa_enrolled"
  | "mfa_removed"
  | "backup_codes_generated"
  | "document_created"
  | "document_deleted"
  | "asset_created"
  | "asset_deleted"
  | "capsule_created"
  | "capsule_deleted"
  | "category_created"
  | "category_deleted"
  | "friend_added"
  | "vault_wiped"
  | "ai_chat_used"
  | "ai_extraction_used"
  | "trusted_device_registered"
  | "trusted_device_revoked"
  | "digital_legacy_reminder_sent"
  | "digital_legacy_grace_period_started"
  | "digital_legacy_awaiting_guardians"
  | "digital_legacy_reset"
  | "digital_legacy_guardian_requested"
  | "digital_legacy_guardian_responded"
  | "digital_legacy_guardians_confirmed"
  | "digital_legacy_reset_by_guardian"
  | "digital_legacy_formal_verification_started"
  | "digital_legacy_final_wait_started"
  | "digital_legacy_triggered"
  | "friend_request_sent"
  | "friend_request_accepted"
  | "friend_request_rejected"
  | "guardian_role_requested"
  | "guardian_role_accepted"
  | "guardian_role_rejected"
  | "guardian_role_revoked"
  | "guardian_role_resigned"
  | "proposal_accepted"
  | "proposal_rejected"
  | "proposal_undone"
  | "dossier_created"
  | "dossier_deleted"
  | "document_trashed"
  | "document_restored"
  | "document_purged"
  | "document_updated"
  | "document_downloaded"
  | "document_text_read"
  | "asset_updated"
  | "friend_updated"
  | "friend_deleted"
  | "capsule_updated"
  | "dossier_updated"
  | "category_updated";

export type AuditEntityType = "document" | "asset" | "friend" | "capsule" | "dossier" | "category";

/** L'item a cui un evento è agganciato (colonne `entity_type`/`entity_id`). Assente per gli eventi di sistema. */
export interface AuditEntityRef {
  type: AuditEntityType;
  id: string;
  /** Titolo dell'item cifrato con la master key, solo per le eliminazioni definitive: serve a riconoscere l'item dopo che non esiste più. Mai in chiaro. */
  encryptedLabel?: string;
}

/** Emesso su `window` quando la scrittura di un evento fallisce, così l'interfaccia può avvisare invece di perderlo in silenzio. */
export const AUDIT_WRITE_FAILED_EVENT = "hinthial:audit-write-failed";

/** Metadati tecnici facoltativi per un evento: mai contenuti, nomi file/amico o altro dato del vault, solo dettagli sul "come". */
export interface AuditEventMetadata {
  /** Come è avvenuto il login: "password" (poi eventualmente completato da MFA), "totp", "backup_code". */
  method?: "password" | "totp" | "backup_code";
  ip?: string | null;
  userAgent?: string | null;
  /** FASE 22 (ai_extraction_used): nome della categoria del documento analizzato --- già in chiaro sul server, mai il file o il testo. */
  category?: string | null;
  /** FASE 22 (ai_extraction_used): con quale permesso la chiamata è stata autorizzata --- "cosa è uscito, quando e perché" della spec. */
  scope?: "category" | "temporary" | "once";
  /** Eventi proposal_*: quale campo riguardava la proposta ("expiry", "category", "issuer", "field") --- mai il valore. */
  proposalKind?: "expiry" | "category" | "issuer" | "field" | "event";
  /** Eventi proposal_* su un campo libero: la chiave normalizzata (già in chiaro nel vocabolario), mai il valore. */
  fieldKey?: string;
  /** ai_extraction_used / document_text_read: vero se il documento era già stato letto (rilettura), falso alla prima lettura. */
  reread?: boolean;
  /** document_updated: quale salvataggio è stato fatto --- "details" (scheda), "note" (testo della nota), "transcript", "ai_exclusion", "ai_reading" (lettura di Hinthia salvata). */
  change?: "details" | "note" | "transcript" | "ai_exclusion" | "ai_reading";
  /** document_updated con change "ai_exclusion": vero se il contenuto è stato escluso da Hinthia, falso se riammesso. */
  excluded?: boolean;
}

/**
 * Records a technical, non-sensitive audit event. Never pass content,
 * passwords, keys or plaintext as part of the event.
 *
 * Auditing must never block the primary action it accompanies: a failure
 * does not throw. It is logged and, in the browser, announced with
 * AUDIT_WRITE_FAILED_EVENT so the interface can warn that the event was
 * not recorded. Returns whether the event was written.
 */
export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  eventType: AuditEventType,
  metadata?: AuditEventMetadata,
  entity?: AuditEntityRef,
): Promise<boolean> {
  const { error } = await supabase.from("audit_events").insert({
    owner_id: ownerId,
    event_type: eventType,
    // AuditEventMetadata is structurally valid Json but not nominally: the interface doesn't satisfy Json's index signature.
    metadata: (metadata ?? null) as Json | null,
    entity_type: entity?.type ?? null,
    entity_id: entity?.id ?? null,
    encrypted_label: entity?.encryptedLabel ?? null,
  });

  if (error) {
    console.error(`[audit] failed to record "${eventType}":`, error.message);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(AUDIT_WRITE_FAILED_EVENT));
    return false;
  }
  return true;
}

/** Come logAuditEvent, per le funzioni che non ricevono l'id del proprietario: lo ricava dalla sessione. */
export async function logAuditEventForCurrentUser(
  supabase: SupabaseClient<Database>,
  eventType: AuditEventType,
  metadata?: AuditEventMetadata,
  entity?: AuditEntityRef,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return logAuditEvent(supabase, user.id, eventType, metadata, entity);
}

/**
 * Registra un tentativo di login con password errata: chi chiama non ha ancora una sessione autenticata (RLS
 * richiederebbe auth.uid() = owner_id), quindi passa da una funzione Postgres SECURITY DEFINER invece di un insert
 * diretto. Non rivela mai se l'email corrisponde a un account esistente: stesso esito silenzioso in entrambi i casi.
 */
export async function logFailedLoginAttempt(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<void> {
  const { error } = await supabase.rpc("log_failed_login_attempt", { target_email: email });
  if (error) {
    console.error("[audit] failed to record \"login_failed\":", error.message);
  }
}
