import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AuditEventListItem } from "@/domain/audit/types";

/**
 * Reads the current user's own audit trail (v. lib/audit/log-event.ts
 * for what gets recorded, and why never anything beyond a plain event
 * type: no filename, no contact name, nothing that would put plaintext
 * content in a technical log). RLS scopes rows to the caller, same as
 * every other list function --- no explicit owner filter needed here.
 */
export async function listAuditEvents(
  supabase: SupabaseClient<Database>,
): Promise<AuditEventListItem[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, event_type, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare il registro attività: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    createdAt: row.created_at,
  }));
}
