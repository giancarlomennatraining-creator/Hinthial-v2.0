import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { ENCRYPTED_DOCUMENTS_BUCKET } from "@/lib/storage/documents-bucket";
import { ENCRYPTED_CAPSULES_BUCKET } from "@/lib/storage/capsules-bucket";
import { AVATARS_BUCKET } from "@/lib/storage/avatars-bucket";

/**
 * Elenca ricorsivamente ogni file (mai una "cartella", riconoscibile da
 * `id === null` nella risposta di Storage) sotto un prefisso --- serve
 * perché i path delle capsule sono a due livelli
 * (`{ownerId}/{capsuleId}/{attachmentId}.json`, v. capsules-bucket.ts),
 * non uno solo come documenti/avatar.
 */
async function listAllFilePaths(
  admin: SupabaseClient<Database>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];

  const paths: string[] = [];
  for (const entry of data) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      paths.push(...(await listAllFilePaths(admin, bucket, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

/**
 * Rimuove ogni oggetto di Storage collegato a un account, in ogni bucket
 * usato da Hinthial --- usata solo dalla cancellazione definitiva
 * dell'account (v. lib/account/actions.ts), con un client admin (service
 * role): a differenza di "Reimposta l'account" (v.
 * domain/danger-zone/repository.ts), qui si enumera l'intera cartella
 * `{ownerId}/` invece di rimuovere solo i path già noti --- corretto qui
 * perché l'account intero sta per sparire, quindi non resta nulla da
 * poter ancora referenziare correttamente.
 */
export async function wipeOwnerStorage(
  admin: SupabaseClient<Database>,
  ownerId: string,
): Promise<void> {
  for (const bucket of [ENCRYPTED_DOCUMENTS_BUCKET, ENCRYPTED_CAPSULES_BUCKET, AVATARS_BUCKET]) {
    const paths = await listAllFilePaths(admin, bucket, ownerId);
    if (paths.length > 0) {
      await admin.storage.from(bucket).remove(paths);
    }
  }
}
