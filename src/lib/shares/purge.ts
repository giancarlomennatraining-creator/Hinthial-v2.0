import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { removeShareFiles } from "@/lib/storage/dossier-shares-bucket";

/**
 * Toglie le copie cifrate dei link scaduti o revocati: dopo la scadenza il link non funziona più (v. loadActiveShare), ma i
 * byte resterebbero in Storage. Gira con il cron giornaliero (v. api/cron/trash-purge), con la service role. Una condivisione
 * che non si riesce a ripulire resta in coda e si riprova il giorno dopo.
 */
export async function runSharesPurge(
  admin: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<{ purged: number; failed: number }> {
  const { data, error } = await admin
    .from("dossier_shares")
    .select("id, owner_id")
    .is("files_purged_at", null)
    .or(`revoked_at.not.is.null,expires_at.lte.${now.toISOString()}`)
    .limit(200);
  if (error) throw new Error(`Impossibile leggere i link da ripulire: ${error.message}`);

  let purged = 0;
  let failed = 0;
  for (const share of data ?? []) {
    try {
      await removeShareFiles(admin, share.owner_id, share.id);
      await admin.from("dossier_shares").update({ files_purged_at: now.toISOString() }).eq("id", share.id);
      purged += 1;
    } catch {
      failed += 1;
    }
  }
  return { purged, failed };
}
