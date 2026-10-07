import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Chi apre un link di condivisione non ha un account: le pagine pubbliche passano dal server con la service role (v.
 * api/shares). Questo è l'unico controllo di accesso, e deve restare identico per ogni errore: un link sbagliato, scaduto
 * o revocato risponde allo stesso modo, così da fuori non si distingue cosa esiste.
 */

export const SHARE_UNAVAILABLE_MESSAGE = "Il link non è valido, è scaduto o è stato revocato.";

export interface ActiveShare {
  id: string;
  ownerId: string;
  encryptedManifest: string;
  allowDownload: boolean;
  expiresAt: string;
}

/** La condivisione, solo se esiste, non è revocata, non è scaduta e le sue copie cifrate ci sono ancora. */
export async function loadActiveShare(
  admin: SupabaseClient<Database>,
  shareId: string,
  now: Date = new Date(),
): Promise<ActiveShare | null> {
  const { data, error } = await admin
    .from("dossier_shares")
    .select("id, owner_id, encrypted_manifest, allow_download, expires_at, revoked_at, files_purged_at")
    .eq("id", shareId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at || data.files_purged_at) return null;
  if (new Date(data.expires_at).getTime() <= now.getTime()) return null;

  return {
    id: data.id,
    ownerId: data.owner_id,
    encryptedManifest: data.encrypted_manifest,
    allowDownload: data.allow_download,
    expiresAt: data.expires_at,
  };
}

/** Un accesso al link, per chi ha condiviso. Non deve mai far fallire la risposta a chi sta guardando. */
export async function recordShareAccess(
  admin: SupabaseClient<Database>,
  share: Pick<ActiveShare, "id" | "ownerId">,
  kind: "open" | "document",
  documentId: string | null,
): Promise<void> {
  try {
    await admin
      .from("dossier_share_accesses")
      .insert({ share_id: share.id, owner_id: share.ownerId, kind, document_id: documentId });
  } catch {
    // Un accesso non registrato è meglio di un documento che non si apre.
  }
}
