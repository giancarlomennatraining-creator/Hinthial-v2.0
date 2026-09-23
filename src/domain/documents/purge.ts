import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { deleteDocument } from "@/domain/documents/repository";

export interface TrashPurgeSummary {
  purged: number;
  failures: number;
}

/**
 * Il giro periodico che elimina per sempre i documenti nel Cestino la
 * cui data di eliminazione definitiva (`purge_at`) è già passata ---
 * chiamato una volta al giorno dal cron di Vercel (v.
 * app/api/cron/trash-purge/route.ts). L'admin client bypassa RLS, quindi
 * questa query vede in un colpo i documenti scaduti di ogni utente, non
 * uno per volta come farebbe un giro sugli utenti (v.
 * digital-legacy/automation.ts, che invece deve farlo perché la sua
 * logica dipende da impostazioni per-utente).
 *
 * Riusa `deleteDocument` --- la stessa funzione che rimuove payload
 * cifrato, miniatura e riga quando l'utente sceglie "Elimina ora" da
 * dentro il Cestino --- invece di duplicarne la logica qui: un solo
 * punto che sa davvero come eliminare un documento per sempre.
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
      // Un documento che non si riesce a eliminare (es. un blob già
      // rimosso da un tentativo precedente andato a metà) non deve
      // fermare gli altri --- si conta e si prosegue, stessa disciplina
      // del recupero testi in FASE 17b.
      failures++;
    }
  }

  return { purged, failures };
}
