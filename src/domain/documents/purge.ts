import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { deleteDocument } from "@/domain/documents/repository";

export interface TrashPurgeSummary {
  purged: number;
  failures: number;
}

/**
 * Cron giornaliero: elimina per sempre i documenti col Cestino scaduto. L'admin client bypassa RLS, vede tutti gli
 * utenti in una query (a differenza di digital-legacy/automation.ts, che dipende da impostazioni per-utente). Riusa
 * `deleteDocument`, la stessa funzione di "Elimina ora".
 */
export async function runTrashPurge(
  admin: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<TrashPurgeSummary> {
  const { data, error } = await admin
    .from("documents")
    .select("id, owner_id, storage_path, has_thumbnail")
    .not("deleted_at", "is", null)
    .lte("purge_at", now.toISOString());

  if (error) {
    throw new Error(`Impossibile leggere il cestino scaduto: ${error.message}`);
  }

  let purged = 0;
  let failures = 0;
  for (const row of data ?? []) {
    try {
      await deleteDocument(admin, row.owner_id, {
        id: row.id,
        storagePath: row.storage_path,
        hasThumbnail: row.has_thumbnail,
      });
      purged++;
    } catch {
      // Un documento che non si riesce a eliminare non ferma gli altri --- si conta e si prosegue.
      failures++;
    }
  }

  return { purged, failures };
}
