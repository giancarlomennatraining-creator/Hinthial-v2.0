import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { documentThumbnailPath, removeEncryptedPayload } from "@/lib/storage/documents-bucket";
import { logAuditEvent } from "@/lib/audit/log-event";
import { computePurgeAt } from "@/domain/documents/trash";
import { removeDocumentSegments } from "@/domain/documents/segments";
import type { DocumentListItem } from "@/domain/documents/types";
import { invalidateVault, VAULT } from "@/lib/vault-store";
import { documentRef } from "@/domain/documents/row-mapping";

/** Elimina per sempre (Storage + riga), senza ripristino --- solo dal cron di purga o "Elimina ora" nel Cestino, mai da "Elimina" in Archivio (che sposta nel cestino, v. sotto). */
export async function deleteDocument(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath" | "hasThumbnail">,
): Promise<void> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  // Il titolo è già cifrato nella riga: lo si copia nell'evento (serve a riconoscere il contenuto dopo l'eliminazione, senza la master key).
  const { data: titleRow } = await supabase
    .from("documents")
    .select("encrypted_filename")
    .eq("id", doc.id)
    .maybeSingle();

  await removeEncryptedPayload(supabase, doc.storagePath);
  if (doc.hasThumbnail) {
    await removeEncryptedPayload(supabase, documentThumbnailPath(doc.storagePath)).catch(() => {});
  }
  await removeDocumentSegments(supabase, doc.storagePath);

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) {
    throw new Error(`Impossibile eliminare il documento: ${error.message}`);
  }

  await logAuditEvent(
    supabase,
    ownerId,
    "document_purged",
    undefined,
    documentRef(doc.id, titleRow?.encrypted_filename),
  );
}

/** Una sola UPDATE per tutti gli id, nessun file toccato. `purgeAt` si calcola UNA VOLTA qui (v. migrazione 20260923000000: non si ricalcola più avanti). */
export async function moveDocumentsToTrash(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentIds: string[],
  retentionDays: number,
): Promise<void> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  if (documentIds.length === 0) return;

  const deletedAt = new Date();
  const purgeAt = computePurgeAt(deletedAt, retentionDays);

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: deletedAt.toISOString(), purge_at: purgeAt.toISOString() })
    .in("id", documentIds);

  if (error) {
    throw new Error(`Impossibile spostare nel cestino: ${error.message}`);
  }

  for (const documentId of documentIds) {
    await logAuditEvent(supabase, ownerId, "document_trashed", undefined, documentRef(documentId));
  }
}

/** Ripristina uno o più documenti dal Cestino --- torna come prima, nessun altro campo viene toccato. */
export async function restoreDocuments(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentIds: string[],
): Promise<void> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  if (documentIds.length === 0) return;

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: null, purge_at: null })
    .in("id", documentIds);

  if (error) {
    throw new Error(`Impossibile ripristinare: ${error.message}`);
  }

  for (const documentId of documentIds) {
    await logAuditEvent(supabase, ownerId, "document_restored", undefined, documentRef(documentId));
  }
}
