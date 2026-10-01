import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listCapsules } from "@/domain/capsules/repository";
import {
  documentSegmentsPath,
  documentThumbnailPath,
  removeEncryptedPayloads,
} from "@/lib/storage/documents-bucket";
import {
  capsuleAttachmentStoragePath,
  removeEncryptedCapsulePayloads,
} from "@/lib/storage/capsules-bucket";
import { resetCategoriesToDefault } from "@/domain/categories/repository";
import { logAuditEvent } from "@/lib/audit/log-event";

/**
 * "Cancella tutto": irreversibile, svuota Archivio/Beni/Amici/Capsule (con i blob in Storage) e ripristina le categorie
 * default. Le Scadenze restano, solo scollegate (ON DELETE SET NULL). Master Key non toccato. Nessun rollback su
 * fallimento a metà, come closeCapsule --- si segnala, non si nasconde.
 */
export async function wipeVault(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
): Promise<void> {
  // Anche i documenti nel Cestino (listDocuments li escluderebbe, lasciando i loro file in Storage), e senza decifrare nulla: servono solo i percorsi.
  const [{ data: documentRows, error: documentsReadError }, capsules] = await Promise.all([
    supabase.from("documents").select("storage_path, has_thumbnail").eq("owner_id", ownerId),
    listCapsules(supabase, masterKey),
  ]);
  if (documentsReadError) {
    throw new Error(`Impossibile leggere l'archivio: ${documentsReadError.message}`);
  }

  // I segmenti non hanno una colonna: il loro percorso si deriva da quello del file, e un oggetto assente non dà errore.
  const documentPaths = (documentRows ?? []).flatMap((row) => [
    row.storage_path,
    documentSegmentsPath(row.storage_path),
    ...(row.has_thumbnail ? [documentThumbnailPath(row.storage_path)] : []),
  ]);
  const capsuleAttachmentPaths = capsules.flatMap((c) =>
    c.attachments.map((a) => capsuleAttachmentStoragePath(ownerId, c.id, a.id)),
  );

  await Promise.all([
    removeEncryptedPayloads(supabase, documentPaths),
    removeEncryptedCapsulePayloads(supabase, capsuleAttachmentPaths),
  ]);

  const { error: documentsError } = await supabase.from("documents").delete().eq("owner_id", ownerId);
  if (documentsError) {
    throw new Error(`Impossibile eliminare l'archivio: ${documentsError.message}`);
  }

  const { error: assetsError } = await supabase.from("assets").delete().eq("owner_id", ownerId);
  if (assetsError) {
    throw new Error(`Impossibile eliminare i beni: ${assetsError.message}`);
  }

  const { error: friendsError } = await supabase.from("friends").delete().eq("owner_id", ownerId);
  if (friendsError) {
    throw new Error(`Impossibile eliminare gli amici: ${friendsError.message}`);
  }

  const { error: capsulesError } = await supabase.from("capsules").delete().eq("owner_id", ownerId);
  if (capsulesError) {
    throw new Error(`Impossibile eliminare le capsule: ${capsulesError.message}`);
  }

  const { error: categoriesError } = await supabase.from("categories").delete().eq("owner_id", ownerId);
  if (categoriesError) {
    throw new Error(`Impossibile eliminare le categorie: ${categoriesError.message}`);
  }

  await resetCategoriesToDefault(supabase, ownerId);
  await logAuditEvent(supabase, ownerId, "vault_wiped");
}
