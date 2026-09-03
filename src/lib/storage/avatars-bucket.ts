import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Public Storage bucket for profile pictures --- plaintext, unlike
 * encrypted-documents/encrypted-capsules (v. the migration for why:
 * treated like first_name/last_name, already plaintext).
 */
export const AVATARS_BUCKET = "avatars";

/**
 * A fresh, unique path every time (not a fixed `{owner}/avatar.jpg`
 * overwritten in place): browsers cache images by URL, so reusing the
 * same path would keep showing the old picture after a re-upload until
 * a hard refresh. The old object is removed separately once the new one
 * is live (see domain/profile/repository.ts, updateAvatar).
 */
export function avatarStoragePath(ownerId: string): string {
  return `${ownerId}/avatar-${Date.now()}.jpg`;
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
