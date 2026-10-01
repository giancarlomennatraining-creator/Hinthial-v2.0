import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { AuditEventMetadata } from "@/lib/audit/log-event";
import type { AuditEventPage, AuditEventQuery } from "@/domain/audit/types";

/**
 * Una pagina del registro eventi dell'utente, filtrata dal query (v. AuditLogPanel). L'impaginazione è dal
 * server: `total` dice quante righe corrispondono ai filtri su tutte le pagine. V. lib/audit/log-event.ts per
 * cosa viene registrato, e perché mai nulla oltre il tipo, metadati tecnici e il riferimento all'item (tipo + id):
 * nessun nome file o di contatto finisce in chiaro in questo log. RLS scopes rows to the caller, same as every
 * other list function --- no explicit owner filter needed here.
 */
export async function listAuditEvents(
  supabase: SupabaseClient<Database>,
  query: AuditEventQuery,
): Promise<AuditEventPage> {
  let request = supabase
    .from("audit_events")
    .select("id, event_type, created_at, metadata, entity_type, entity_id, encrypted_label", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

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
  if (query.entity) {
    request = request.eq("entity_type", query.entity.type).eq("entity_id", query.entity.id);
  }

  const from = (query.page - 1) * query.pageSize;
  const { data, error, count } = await request.range(from, from + query.pageSize - 1);

  if (error) {
    throw new Error(`Impossibile caricare il registro attività: ${error.message}`);
  }

  return {
    events: (data ?? []).map((row) => ({
      id: row.id,
      type: row.event_type,
      createdAt: row.created_at,
      metadata: (row.metadata as AuditEventMetadata | null) ?? null,
      entityType: row.entity_type,
      entityId: row.entity_id,
      encryptedLabel: row.encrypted_label,
    })),
    total: count ?? 0,
  };
}
