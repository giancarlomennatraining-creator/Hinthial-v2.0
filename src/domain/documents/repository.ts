import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  encryptDocument,
  decryptDocument,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
  type EncryptedDocument,
} from "@/lib/crypto";
import {
  documentStoragePath,
  downloadEncryptedPayload,
  removeEncryptedPayload,
  uploadEncryptedPayload,
} from "@/lib/storage/documents-bucket";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { Category, DocumentListItem } from "@/domain/documents/types";

export async function listCategories(supabase: SupabaseClient<Database>): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("name");

  if (error) {
    throw new Error(`Impossibile caricare le categorie: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Lists the current user's documents, decrypting each filename
 * client-side with the (already unlocked) Master Key. The server only
 * ever returns ciphertext; decryption happens here, not on the server.
 */
export async function listDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i documenti: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => {
      const filenameBytes = await decryptBytes(masterKey, parseEnvelope(row.encrypted_filename));
      return {
        id: row.id,
        filename: bytesToUtf8(filenameBytes),
        mimeType: row.mime_type,
        size: row.size,
        categoryId: row.category_id,
        createdAt: row.created_at,
        storagePath: row.storage_path,
        wrappedDocumentKey: row.wrapped_document_key,
      };
    }),
  );
}

/**
 * Encrypts `file` client-side (content under a fresh Document Key,
 * filename under the Master Key directly) and uploads only ciphertext:
 * the payload to Storage, everything else to the `documents` row. The
 * server never sees the plaintext file or its real name.
 */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  file: File,
  categoryId: string | null,
): Promise<void> {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const { wrappedDocumentKey, payload } = await encryptDocument(masterKey, plaintext);
  const encryptedFilename = await encryptBytes(masterKey, utf8ToBytes(file.name));

  const documentId = crypto.randomUUID();
  const storagePath = documentStoragePath(ownerId, documentId);

  await uploadEncryptedPayload(supabase, storagePath, serializeEnvelope(payload));

  const { error } = await supabase.from("documents").insert({
    id: documentId,
    owner_id: ownerId,
    encrypted_filename: serializeEnvelope(encryptedFilename),
    wrapped_document_key: serializeEnvelope(wrappedDocumentKey),
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
    category_id: categoryId,
  });

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned blob.
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
}

/** Downloads and decrypts a document's content client-side. */
export async function downloadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: DocumentListItem,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const serializedPayload = await downloadEncryptedPayload(supabase, doc.storagePath);

  const encrypted: EncryptedDocument = {
    wrappedDocumentKey: parseEnvelope(doc.wrappedDocumentKey),
    payload: parseEnvelope(serializedPayload),
  };
  const bytes = await decryptDocument(masterKey, encrypted);

  return { filename: doc.filename, mimeType: doc.mimeType, bytes };
}

export async function deleteDocument(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath">,
): Promise<void> {
  await removeEncryptedPayload(supabase, doc.storagePath);

  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) {
    throw new Error(`Impossibile eliminare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_deleted");
}
