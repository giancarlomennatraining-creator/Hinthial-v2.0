import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";

/**
 * Event types recordable so far. Extended by later phases (each adding
 * its own migration to widen the `audit_events.event_type` check
 * constraint) --- see supabase/migrations and HINTHIAL_MVP.md sezione 5.
 */
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
  | "document_purged";

/**
 * Metadati tecnici facoltativi per un evento --- mai contenuti, nomi
 * file/amico o altro dato del vault, solo dettagli sul "come" (es. il
 * metodo di login, IP e user agent, il motivo di un fallimento).
 */
export interface AuditEventMetadata {
  /** Come è avvenuto il login: "password" (poi eventualmente completato da MFA), "totp", "backup_code". */
  method?: "password" | "totp" | "backup_code";
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Records a technical, non-sensitive audit event. Never pass content,
 * passwords, keys or plaintext as part of the event.
 *
 * Auditing must never block the primary action it accompanies: failures
 * are logged server-side and swallowed rather than surfaced to the user.
 */
export async function logAuditEvent(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  eventType: AuditEventType,
  metadata?: AuditEventMetadata,
): Promise<void> {
  const { error } = await supabase.from("audit_events").insert({
    owner_id: ownerId,
    event_type: eventType,
    // AuditEventMetadata is a plain flat record of strings/nulls: a
    // structurally valid Json, just not nominally --- the interface (for
    // named, documented fields) doesn't satisfy Json's index signature.
    metadata: (metadata ?? null) as Json | null,
  });

  if (error) {
    console.error(`[audit] failed to record "${eventType}":`, error.message);
  }
}

/**
 * Registra un tentativo di login con password errata --- a differenza di
 * logAuditEvent, chi chiama non ha ancora una sessione autenticata (RLS
 * richiederebbe auth.uid() = owner_id, che qui non esiste), quindi passa
 * da una funzione Postgres SECURITY DEFINER (v. la migrazione
 * audit_events_expansion) invece di un insert diretto. Non rivela mai se
 * l'email corrisponde a un account esistente: stessa chiamata, stesso
 * esito silenzioso, in entrambi i casi --- niente enumerazione account.
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
