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
import type {
  Category,
  DocumentListItem,
  DocumentMetadataInput,
} from "@/domain/documents/types";

const DOCUMENT_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, expires_at, encrypted_notes, encrypted_tags, created_at";

type DocumentRow = {
  id: string;
  encrypted_filename: string;
  wrapped_document_key: string;
  storage_path: string;
  mime_type: string;
  size: number;
  category_id: string | null;
  expires_at: string | null;
  encrypted_notes: string | null;
  encrypted_tags: string | null;
  created_at: string;
};

/** null/empty in -> null out: nothing to encrypt, nothing stored. */
async function encryptOptionalText(
  masterKey: CryptoKey,
  text: string,
): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

async function decryptOptionalText(
  masterKey: CryptoKey,
  serialized: string | null,
): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}

async function encryptTags(masterKey: CryptoKey, tags: string[]): Promise<string | null> {
  if (tags.length === 0) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(tags))));
}

async function decryptTags(masterKey: CryptoKey, serialized: string | null): Promise<string[]> {
  if (!serialized) return [];
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  const parsed: unknown = JSON.parse(bytesToUtf8(bytes));
  return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
}

async function toDocumentListItem(
  masterKey: CryptoKey,
  row: DocumentRow,
): Promise<DocumentListItem> {
  const [filenameBytes, notes, tags] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
    decryptOptionalText(masterKey, row.encrypted_notes),
    decryptTags(masterKey, row.encrypted_tags),
  ]);

  return {
    id: row.id,
    filename: bytesToUtf8(filenameBytes),
    mimeType: row.mime_type,
    size: row.size,
    categoryId: row.category_id,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    wrappedDocumentKey: row.wrapped_document_key,
    expiresAt: row.expires_at,
    notes,
    tags,
  };
}

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
 * Lists the current user's documents, decrypting each filename/notes/
 * tags client-side with the (already unlocked) Master Key. The server
 * only ever returns ciphertext; decryption happens here, not on the
 * server.
 */
export async function listDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i documenti: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toDocumentListItem(masterKey, row)));
}

/**
 * Encrypts `file` client-side (content under a fresh Document Key,
 * filename/notes/tags under the Master Key directly) and uploads only
 * ciphertext: the payload to Storage, everything else to the
 * `documents` row. The server never sees the plaintext file or any of
 * this metadata.
 */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  file: File,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const [{ wrappedDocumentKey, payload }, encryptedFilename, encryptedNotes, encryptedTags] =
    await Promise.all([
      encryptDocument(masterKey, plaintext),
      encryptBytes(masterKey, utf8ToBytes(file.name)),
      encryptOptionalText(masterKey, metadata.notes),
      encryptTags(masterKey, metadata.tags),
    ]);

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
    category_id: metadata.categoryId,
    expires_at: metadata.expiresAt,
    encrypted_notes: encryptedNotes,
    encrypted_tags: encryptedTags,
  });

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned blob.
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
}

/**
 * Updates a document's metadata (category, expiry, notes, tags) ---
 * never the file content or its name. Re-encrypts notes/tags with the
 * Master Key, same as at upload time.
 */
export async function updateDocumentMetadata(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const [encryptedNotes, encryptedTags] = await Promise.all([
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
  ]);

  const { error } = await supabase
    .from("documents")
    .update({
      category_id: metadata.categoryId,
      expires_at: metadata.expiresAt,
      encrypted_notes: encryptedNotes,
      encrypted_tags: encryptedTags,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile aggiornare il documento: ${error.message}`);
  }
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
