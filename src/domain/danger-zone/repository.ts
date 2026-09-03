import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listDocuments } from "@/domain/documents/repository";
import { listCapsules } from "@/domain/capsules/repository";
import { removeEncryptedPayloads } from "@/lib/storage/documents-bucket";
import {
  capsuleAttachmentStoragePath,
  removeEncryptedCapsulePayloads,
} from "@/lib/storage/capsules-bucket";
import { resetCategoriesToDefault } from "@/domain/categories/repository";
import { logAuditEvent } from "@/lib/audit/log-event";

/**
 * "Cancella tutto" (Impostazioni > Zona pericolosa) --- irreversibile:
 * svuota Archivio, Asset, Contatti fiduciari e Capsule (con tutti i
 * relativi blob cifrati in Storage), poi ripristina le categorie
 * predefinite al posto di quelle personalizzate dell'utente.
 *
 * Le Scadenze non vengono toccate --- solo scollegate dai documenti/
 * asset appena cancellati (related_document_id/related_asset_id sono
 * ON DELETE SET NULL, v. migrations), esattamente come già succede
 * eliminando un singolo asset/documento oggi. Il Master Key/la
 * configurazione di cifratura non vengono toccati: l'utente resta
 * autenticato e può continuare a usare Hinthial da capo.
 *
 * I documenti/le capsule vanno decifrati (serve masterKey) solo per
 * scoprire i path da rimuovere in Storage: per i documenti la colonna
 * storage_path è già in chiaro, ma per gli allegati delle capsule il
 * loro id --- da cui il path è derivato --- vive dentro encrypted_payload.
 *
 * Un fallimento a metà strada lascia il vault in uno stato parziale
 * (nessun rollback complessivo, non diversamente da closeCapsule) --- lo
 * si segnala chiaramente, non lo si nasconde.
 */
export async function wipeVault(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
): Promise<void> {
  const [documents, capsules] = await Promise.all([
    listDocuments(supabase, masterKey),
    listCapsules(supabase, masterKey),
  ]);

  const documentPaths = documents.map((d) => d.storagePath);
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
    throw new Error(`Impossibile eliminare gli asset: ${assetsError.message}`);
  }

  const { error: contactsError } = await supabase
    .from("trusted_contacts")
    .delete()
    .eq("owner_id", ownerId);
  if (contactsError) {
    throw new Error(`Impossibile eliminare i contatti fiduciari: ${contactsError.message}`);
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
