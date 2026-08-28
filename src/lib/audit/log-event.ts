import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Event types recordable so far. Extended by later phases (each adding
 * its own migration to widen the `audit_events.event_type` check
 * constraint) --- see supabase/migrations and HINTHIAL_MVP.md sezione 5.
 */
export type AuditEventType = "login" | "logout" | "document_created" | "document_deleted";

/**
 * Records a technical, non-sensitive audit event. Never pass content,
 * passwords, keys or plaintext as part of the event.
 *
 * Auditing must never block the primary action it accompanies: failures
 * are logged server-side and swallowed rather than surfaced to the user.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  ownerId: string,
  eventType: AuditEventType,
): Promise<void> {
  const { error } = await supabase
    .from("audit_events")
    .insert({ owner_id: ownerId, event_type: eventType });

  if (error) {
    console.error(`[audit] failed to record "${eventType}":`, error.message);
  }
}
