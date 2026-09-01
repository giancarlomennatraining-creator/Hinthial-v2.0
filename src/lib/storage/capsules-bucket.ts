import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Private Storage bucket holding encrypted capsule attachment payloads
 * (see supabase/migrations, FASE 8). Same shape as encrypted-documents:
 * the server only ever sees ciphertext, a serialized EncryptedEnvelope
 * (src/lib/crypto/envelope.ts) produced client-side before upload.
 */
export const ENCRYPTED_CAPSULES_BUCKET = "encrypted-capsules";

/**
 * RLS on storage.objects requires the first path segment to be the
 * owner's user id. Deterministic (owner/capsule/attachment), so no
 * plaintext storage_path column is needed --- unlike documents.
 */
export function capsuleAttachmentStoragePath(
  ownerId: string,
  capsuleId: string,
  attachmentId: string,
): string {
  return `${ownerId}/${capsuleId}/${attachmentId}.json`;
}

export async function uploadEncryptedCapsulePayload(
  supabase: SupabaseClient<Database>,
  path: string,
  serializedEnvelope: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(ENCRYPTED_CAPSULES_BUCKET)
    .upload(path, new Blob([serializedEnvelope], { type: "application/json" }), {
      upsert: false,
    });

  if (error) {
    throw new Error(`Impossibile caricare l'allegato cifrato: ${error.message}`);
  }
}

export async function downloadEncryptedCapsulePayload(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(ENCRYPTED_CAPSULES_BUCKET).download(path);

  if (error || !data) {
    throw new Error(`Impossibile scaricare l'allegato cifrato: ${error?.message ?? "dati mancanti"}`);
  }

  return data.text();
}

export async function removeEncryptedCapsulePayloads(
  supabase: SupabaseClient<Database>,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from(ENCRYPTED_CAPSULES_BUCKET).remove(paths);

  if (error) {
    throw new Error(`Impossibile eliminare gli allegati cifrati: ${error.message}`);
  }
}
