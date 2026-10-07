import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Bucket privato con le copie dei documenti condivisi, cifrate con la chiave di condivisione (quella che sta solo nel
 * link, v. migrazione dossier_shares). Il server vede solo byte cifrati: ogni oggetto è un EncryptedEnvelope serializzato.
 */
export const DOSSIER_SHARES_BUCKET = "dossier-shares";

/** Il primo segmento è l'id di chi condivide (le regole di accesso lo richiedono), poi la condivisione e il documento. */
export function shareFilePath(ownerId: string, shareId: string, documentId: string): string {
  return `${ownerId}/${shareId}/${documentId}.json`;
}

export async function uploadShareFile(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(DOSSIER_SHARES_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), { upsert: false });

  if (error) {
    throw new Error(`Impossibile caricare la copia condivisa: ${error.message}`);
  }
}

/** Toglie tutte le copie di una condivisione (una cartella). Un oggetto già assente non è un errore. */
export async function removeShareFiles(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  shareId: string,
): Promise<void> {
  const folder = `${ownerId}/${shareId}`;
  const { data, error } = await supabase.storage.from(DOSSIER_SHARES_BUCKET).list(folder, { limit: 1000 });
  if (error) {
    throw new Error(`Impossibile leggere le copie condivise: ${error.message}`);
  }
  const paths = (data ?? []).map((entry) => `${folder}/${entry.name}`);
  if (paths.length === 0) return;

  const { error: removeError } = await supabase.storage.from(DOSSIER_SHARES_BUCKET).remove(paths);
  if (removeError) {
    throw new Error(`Impossibile togliere le copie condivise: ${removeError.message}`);
  }
}

/** Prima di eliminare un fascicolo: le righe dei link spariscono da sole, ma le copie cifrate in Storage no. */
export async function removeDossierShareFiles(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dossierId: string,
): Promise<void> {
  const { data } = await supabase.from("dossier_shares").select("id").eq("dossier_id", dossierId);
  for (const row of data ?? []) {
    await removeShareFiles(supabase, ownerId, row.id).catch(() => undefined);
  }
}

/** Tutte le copie condivise di un utente (per "Cancella tutto"): ogni cartella sotto `{ownerId}/`. */
export async function removeAllOwnerShareFiles(supabase: SupabaseClient<Database>, ownerId: string): Promise<void> {
  const { data } = await supabase.from("dossier_shares").select("id").eq("owner_id", ownerId);
  for (const row of data ?? []) {
    await removeShareFiles(supabase, ownerId, row.id).catch(() => undefined);
  }
}
