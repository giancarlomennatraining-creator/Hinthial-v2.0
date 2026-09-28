import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Public Storage bucket for profile pictures, plaintext unlike encrypted-documents/encrypted-capsules: treated like first_name/last_name, already plaintext. */
export const AVATARS_BUCKET = "avatars";

/** A fresh, unique path every time: browsers cache images by URL, reusing the same path would keep showing the old picture until a hard refresh. The old object is removed separately once the new one is live. */
export function avatarStoragePath(ownerId: string): string {
  return `${ownerId}/avatar-${Date.now()}.jpg`;
}

/** Come avatarStoragePath, ma per la foto di un amico caricata dal proprietario: resta nella cartella `{ownerId}/...`, nessuna nuova regola necessaria. `friendId` nel nome è solo per riconoscere il file a colpo d'occhio. */
export function friendAvatarStoragePath(ownerId: string, friendId: string): string {
  return `${ownerId}/friend-${friendId}-${Date.now()}.jpg`;
}

export async function uploadAvatarBlob(
  supabase: SupabaseClient<Database>,
  path: string,
  blob: Blob,
): Promise<void> {
  const { error } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg" });

  if (error) {
    throw new Error(`Impossibile caricare la foto profilo: ${error.message}`);
  }
}

/** Bucket pubblico: costruzione locale dell'URL, nessuna richiesta di rete. */
export function avatarPublicUrl(supabase: SupabaseClient<Database>, path: string): string {
  return supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function removeAvatarBlob(
  supabase: SupabaseClient<Database>,
  path: string,
): Promise<void> {
  const { error } = await supabase.storage.from(AVATARS_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Impossibile eliminare la foto profilo: ${error.message}`);
  }
}
