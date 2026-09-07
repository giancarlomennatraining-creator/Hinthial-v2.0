import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AuditEventMetadata } from "@/lib/audit/log-event";
import type { AuditEventListItem, AuditEventQuery } from "@/domain/audit/types";

/**
 * Reads the current user's own audit trail, filtered by the given query
 * (v. AuditLogPanel: data inizio/fine + tipi, invece di caricare sempre
 * tutto). V. lib/audit/log-event.ts per cosa viene registrato, e perché
 * mai nulla oltre un tipo evento e metadati tecnici: nessun filename,
 * nome contatto o altro dato del vault finisce in questo log. RLS scopes
 * rows to the caller, same as every other list function --- no explicit
 * owner filter needed here.
 */
export async function listAuditEvents(
  supabase: SupabaseClient<Database>,
  query: AuditEventQuery,
): Promise<AuditEventListItem[]> {
  let request = supabase
    .from("audit_events")
    .select("id, event_type, created_at, metadata")
    .order("created_at", { ascending: false });

  if (query.startDate) {
    request = request.gte("created_at", new Date(`${query.startDate}T00:00:00`).toISOString());
  }
  if (query.endDate) {
    // Estremo incluso: il limite vero è la mezzanotte del giorno *dopo*.
    const endExclusive = new Date(`${query.endDate}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    request = request.lt("created_at", endExclusive.toISOString());
  }
  if (query.types.length > 0) {
    request = request.in("event_type", query.types);
  }

  const { data, error } = await request;

  if (error) {
    throw new Error(`Impossibile caricare il registro attività: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.event_type,
    createdAt: row.created_at,
    metadata: (row.metadata as AuditEventMetadata | null) ?? null,
  }));
}
