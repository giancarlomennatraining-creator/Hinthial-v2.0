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
import { NOTE_MIME_TYPE } from "@/lib/content-kind";
import { canExtractText, extractText } from "@/domain/extraction/extract-text";
import type {
  DocumentListItem,
  DocumentMetadataInput,
  TextNoteInput,
} from "@/domain/documents/types";

/**
 * Le fasi visibili di un caricamento --- v. uploadDocument, `onPhase`.
 * "reading" può durare qualche secondo su un PDF lungo, e parecchi di
 * più sull'OCR di una foto: dirlo è l'unica differenza tra un'attesa
 * spiegata e una inspiegata.
 */
export type UploadPhase = "reading" | "saving";

/**
 * Notifica di avanzamento: la fase in corso e, quando il motore sa
 * stimarlo, quanto manca (0-1). `null` significa "non stimabile", non
 * "zero" --- chi lo riceve deve mostrare un'attesa senza percentuale,
 * non una percentuale ferma a 0 (v. FASE 17c).
 */
export type UploadPhaseListener = (phase: UploadPhase, progress: number | null) => void;

const DOCUMENT_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_tags, encrypted_transcript, encrypted_extracted_text, extracted_at, created_at";

type DocumentRow = {
  id: string;
  encrypted_filename: string;
  wrapped_document_key: string;
  storage_path: string;
  mime_type: string;
  size: number;
  category_id: string | null;
  related_asset_id: string | null;
  expires_at: string | null;
  encrypted_notes: string | null;
  encrypted_tags: string | null;
  encrypted_transcript: string | null;
  encrypted_extracted_text: string | null;
  extracted_at: string | null;
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
  const [filenameBytes, notes, tags, transcript, extractedText] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
    decryptOptionalText(masterKey, row.encrypted_notes),
    decryptTags(masterKey, row.encrypted_tags),
    decryptOptionalText(masterKey, row.encrypted_transcript),
    decryptOptionalText(masterKey, row.encrypted_extracted_text),
  ]);

  return {
    id: row.id,
    filename: bytesToUtf8(filenameBytes),
    mimeType: row.mime_type,
    size: row.size,
    categoryId: row.category_id,
    relatedAssetId: row.related_asset_id,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    wrappedDocumentKey: row.wrapped_document_key,
    expiresAt: row.expires_at,
    notes,
    tags,
    transcript,
    extractedText,
    extractedAt: row.extracted_at,
  };
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
 * Fetches a specific set of documents by id (e.g. capsule attachments
 * linking to existing vault documents, FASE 8), decrypting each client-
 * side. Ids that no longer exist (or belong to someone else, filtered
 * out by RLS) are silently omitted --- callers should treat a shorter
 * result as "some referenced documents are gone", not an error.
 */
export async function getDocumentsByIds(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ids: string[],
): Promise<DocumentListItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from("documents").select(DOCUMENT_COLUMNS).in("id", ids);

  if (error) {
    throw new Error(`Impossibile caricare i documenti collegati: ${error.message}`);
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
  onPhase?: UploadPhaseListener,
): Promise<void> {
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

  // FASE 17 --- il testo si ricava QUI, dove il contenuto è ancora in
  // chiaro in memoria: nessun download né decifratura in più, e nulla
  // lascia il dispositivo (v. domain/extraction). Best-effort: se
  // l'estrazione non riesce si salva il documento lo stesso, si perde
  // solo la possibilità di cercarci dentro.
  //
  // `onPhase` esiste perché leggere un PDF lungo richiede qualche
  // secondo: senza, l'interfaccia direbbe "Salvataggio…" mentre in
  // realtà sta leggendo (v. FASE 17b, richiesta utente). L'OCR di una
  // foto ne richiede molti di più, e per quello riporta anche una
  // percentuale (v. FASE 17c).
  const willExtract = canExtractText(mimeType);
  if (willExtract) onPhase?.("reading", null);
  const extractedText = await extractText(plaintext, mimeType, (fraction) =>
    onPhase?.("reading", fraction),
  );

  onPhase?.("saving", null);

  const [
    { wrappedDocumentKey, payload },
    encryptedFilename,
    encryptedNotes,
    encryptedTags,
    encryptedExtractedText,
  ] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    encryptBytes(masterKey, utf8ToBytes(file.name)),
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
    encryptOptionalText(masterKey, extractedText ?? ""),
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
    mime_type: mimeType,
    size: file.size,
    category_id: metadata.categoryId,
    related_asset_id: metadata.relatedAssetId,
    expires_at: metadata.expiresAt,
    encrypted_notes: encryptedNotes,
    encrypted_tags: encryptedTags,
    encrypted_extracted_text: encryptedExtractedText,
    // Marcato solo se un motore ha davvero provato a leggere: per un
    // tipo non ancora supportato resta null, così un OCR futuro saprà
    // che quel contenuto è ancora tutto da guardare.
    extracted_at: willExtract ? new Date().toISOString() : null,
  });

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned blob.
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
}

/**
 * Creates a text note: same table, same encryption as any other
 * archive item --- the note's body is encrypted as if it were a file's
 * bytes, its title as if it were a filename. Distinguished from a
 * regular uploaded file only by mime_type (NOTE_MIME_TYPE), which is
 * what lets the UI show it as an editable note instead of a download
 * (v. lib/content-kind.ts).
 */
export async function createTextNote(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  note: TextNoteInput,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename, encryptedNotes, encryptedTags] =
    await Promise.all([
      encryptDocument(masterKey, plaintext),
      encryptBytes(masterKey, utf8ToBytes(note.title)),
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
    mime_type: NOTE_MIME_TYPE,
    size: plaintext.byteLength,
    category_id: metadata.categoryId,
    related_asset_id: metadata.relatedAssetId,
    expires_at: metadata.expiresAt,
    encrypted_notes: encryptedNotes,
    encrypted_tags: encryptedTags,
  });

  if (error) {
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare la nota: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created");
}

/**
 * Updates a text note's own title/body --- the one kind of archive item
 * whose content is meant to be edited in place, rather than replaced by
 * re-uploading. Re-encrypts with a fresh Document Key (same as any
 * fresh encryptDocument call) and uploads to a *new* storage path
 * rather than overwriting the old one --- same reason avatars get a
 * fresh path on every re-upload (v. lib/storage/avatars-bucket.ts):
 * Storage reads can otherwise be served briefly stale, which here would
 * mean ciphertext encrypted under the *old* key paired with the row's
 * *new* wrapped key --- decryption fails outright rather than just
 * showing old content, so it isn't a corner case worth risking.
 */
export async function updateTextNoteContent(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath">,
  note: TextNoteInput,
): Promise<void> {
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    encryptBytes(masterKey, utf8ToBytes(note.title)),
  ]);

  const newStoragePath = `${ownerId}/${doc.id}-${Date.now()}.json`;
  await uploadEncryptedPayload(supabase, newStoragePath, serializeEnvelope(payload));

  const { error } = await supabase
    .from("documents")
    .update({
      encrypted_filename: serializeEnvelope(encryptedFilename),
      wrapped_document_key: serializeEnvelope(wrappedDocumentKey),
      storage_path: newStoragePath,
      size: plaintext.byteLength,
    })
    .eq("id", doc.id);

  if (error) {
    await removeEncryptedPayload(supabase, newStoragePath).catch(() => {});
    throw new Error(`Impossibile aggiornare la nota: ${error.message}`);
  }

  await removeEncryptedPayload(supabase, doc.storagePath).catch(() => {});
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
      related_asset_id: metadata.relatedAssetId,
      expires_at: metadata.expiresAt,
      encrypted_notes: encryptedNotes,
      encrypted_tags: encryptedTags,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile aggiornare il documento: ${error.message}`);
  }
}

/**
 * Updates an audio/video item's transcript --- a separate action from
 * updateDocumentMetadata (it's shown only for that content kind, not
 * part of the generic metadata form). Written by hand today (v.
 * domain/transcription): swapping in a real engine later only changes
 * what fills the textarea, not this function.
 */
export async function updateDocumentTranscript(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  transcript: string,
): Promise<void> {
  const encryptedTranscript = await encryptOptionalText(masterKey, transcript);

  const { error } = await supabase
    .from("documents")
    .update({ encrypted_transcript: encryptedTranscript })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare la trascrizione: ${error.message}`);
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

/**
 * FASE 17b --- i contenuti già in archivio da prima che l'estrazione
 * esistesse: `extractedAt` null e un tipo che oggi sappiamo leggere.
 * Sono gli unici per cui la ricerca dentro il file non funziona ancora.
 */
export function documentsAwaitingExtraction(documents: DocumentListItem[]): DocumentListItem[] {
  return documents.filter((doc) => doc.extractedAt === null && canExtractText(doc.mimeType));
}

/**
 * Legge un contenuto già archiviato e ne salva il testo --- l'unico
 * caso in cui serve scaricare e decifrare il file, non avendolo più in
 * chiaro come al momento del caricamento.
 *
 * Marca `extracted_at` **anche quando non trova nulla**: è ciò che
 * distingue "già guardato, non aveva testo" (una scansione, in attesa
 * dell'OCR) da "mai guardato", evitando di riprovare all'infinito sugli
 * stessi file.
 */
export async function extractTextForExistingDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: DocumentListItem,
  onProgress?: (fraction: number) => void,
): Promise<{ foundText: boolean }> {
  const { bytes } = await downloadDocument(supabase, masterKey, doc);
  const text = await extractText(bytes, doc.mimeType, onProgress);

  const { error } = await supabase
    .from("documents")
    .update({
      encrypted_extracted_text: await encryptOptionalText(masterKey, text ?? ""),
      extracted_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (error) {
    throw new Error(`Impossibile salvare il testo estratto: ${error.message}`);
  }

  return { foundText: Boolean(text) };
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
