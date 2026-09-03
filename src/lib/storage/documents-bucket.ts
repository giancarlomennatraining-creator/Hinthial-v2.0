import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Private Storage bucket holding encrypted document payloads (see
 * supabase/migrations, FASE 4). The server only ever sees ciphertext:
 * every object here is a serialized EncryptedEnvelope
 * (src/lib/crypto/envelope.ts), produced client-side before upload.
 */
export const ENCRYPTED_DOCUMENTS_BUCKET = "encrypted-documents";

/** RLS on storage.objects requires the first path segment to be the owner's user id. */
export function documentStoragePath(ownerId: string, documentId: string): string {
  return `${ownerId}/${documentId}.json`;
}

export async function uploadEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ENCRYPTED_DOCUMENTS_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), {
      upsert: false,
    });

  if (error) {
    throw new Error(`Impossibile caricare il file cifrato: ${error.message}`);
  }
}

export async function downloadEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Impossibile scaricare il file cifrato: ${error?.message ?? "dati mancanti"}`);
  }

  return data.text();
}

export async function removeEncryptedPayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Impossibile eliminare il file cifrato: ${error.message}`);
  }
}

/** Same as removeEncryptedPayload, batched --- v. domain/danger-zone, "Cancella tutto". */
export async function removeEncryptedPayloads(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(ENCRYPTED_DOCUMENTS_BUCKET).remove(paths);

  if (error) {
    throw new Error(`Impossibile eliminare i file cifrati: ${error.message}`);
  }
}
