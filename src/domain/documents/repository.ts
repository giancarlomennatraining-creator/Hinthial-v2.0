import { mimeTypeOfFile } from "@/lib/file-mime";
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
  documentThumbnailPath,
  downloadEncryptedPayload,
  downloadOptionalEncryptedPayload,
  removeEncryptedPayload,
  uploadEncryptedPayload,
  uploadEncryptedThumbnail,
} from "@/lib/storage/documents-bucket";
import { logAuditEvent, type AuditEntityRef, type AuditEventMetadata } from "@/lib/audit/log-event";
import {
  isAnalysisStatus,
  parsePersistedAnalysis,
  type AnalysisStatus,
  type PersistedContentAnalysis,
} from "@/domain/ai/analysis/persisted";
import { computePurgeAt } from "@/domain/documents/trash";
import {
  listAllDossierLinks,
  listDossierIdsForDocuments,
  replaceDocumentDossierLinks,
} from "@/domain/dossiers/repository";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import type { ContentSegment } from "@/domain/extraction/types";
import { removeDocumentSegments, saveDocumentSegments } from "@/domain/documents/segments";
import { canHaveThumbnail, createThumbnail } from "@/lib/thumbnail";
import type {
  DocumentListItem,
  DocumentSummary,
  DocumentMetadataInput,
  TextNoteInput,
} from "@/domain/documents/types";

/** V. uploadDocument, `onPhase` --- "reading" può durare da secondi a decine su OCR di una foto. */
export type UploadPhase = "reading" | "saving";

/** `null` = non stimabile (mostra attesa senza percentuale), non "zero" (v. FASE 17c). */
export type UploadPhaseListener = (phase: UploadPhase, progress: number | null) => void;

/** FASE 19b: una lettura già fatta al momento della scelta del file, per non rileggere al salvataggio. `attempted: false` = si è salvato mentre leggeva ancora, `extracted_at` resta nullo (recuperato da "Leggili ora", FASE 17b). */
export interface PriorExtraction {
  text: string | null;
  /** Le pagine lette, per la provenienza dell'analisi di Hinthia: se mancano si salva solo il testo. */
  segments?: ContentSegment[];
  attempted: boolean;
}

export interface UploadOptions {
  /** Il nome con cui salvare il contenuto --- di default quello del file. */
  title?: string;
  /** Una lettura già fatta; se assente, si legge qui. */
  extraction?: PriorExtraction;
  onPhase?: UploadPhaseListener;
}

const DOCUMENT_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_tags, encrypted_issuer, encrypted_transcript, encrypted_extracted_text, extracted_at, has_thumbnail, deleted_at, purge_at, ai_extraction_excluded, encrypted_structured_fields, encrypted_ai_synthesis, ai_synthesis_generated_at, encrypted_content_analysis, analysis_status, analysis_updated_at, created_at";

/** Come DOCUMENT_COLUMNS, senza testo letto, trascrizione, sintesi e analisi: v. DocumentSummary. */
const DOCUMENT_SUMMARY_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_tags, encrypted_issuer, extracted_at, has_thumbnail, deleted_at, purge_at, ai_extraction_excluded, encrypted_structured_fields, ai_synthesis_generated_at, analysis_status, analysis_updated_at, created_at";

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
  encrypted_issuer: string | null;
  encrypted_transcript: string | null;
  encrypted_extracted_text: string | null;
  extracted_at: string | null;
  has_thumbnail: boolean;
  deleted_at: string | null;
  purge_at: string | null;
  ai_extraction_excluded: boolean;
  encrypted_structured_fields: string | null;
  encrypted_ai_synthesis: string | null;
  ai_synthesis_generated_at: string | null;
  encrypted_content_analysis: string | null;
  analysis_status: string | null;
  analysis_updated_at: string | null;
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

/** Come encryptTags/decryptTags, ma per un oggetto {chiave: valore} invece di un array --- i campi eterogenei aperti (v. domain/proposals, kind "field"), mai le tre colonne dedicate esistenti. */
export async function encryptStructuredFields(
  masterKey: CryptoKey,
  fields: Record<string, string>,
): Promise<string | null> {
  if (Object.keys(fields).length === 0) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(fields))));
}

export async function decryptStructuredFields(
  masterKey: CryptoKey,
  serialized: string | null,
): Promise<Record<string, string>> {
  if (!serialized) return {};
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  const parsed: unknown = JSON.parse(bytesToUtf8(bytes));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/** Un blocco che non si decifra o non si capisce vale "nessuna lettura salvata": l'utente può rileggere, la scheda non si rompe. */
async function decryptContentAnalysis(
  masterKey: CryptoKey,
  serialized: string | null,
): Promise<PersistedContentAnalysis | null> {
  if (!serialized) return null;
  try {
    const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
    return parsePersistedAnalysis(JSON.parse(bytesToUtf8(bytes)));
  } catch {
    return null;
  }
}

async function toDocumentListItem(
  masterKey: CryptoKey,
  row: DocumentRow,
  dossierIds: string[],
): Promise<DocumentListItem> {
  const [
    filenameBytes,
    notes,
    tags,
    issuer,
    transcript,
    extractedText,
    structuredFields,
    aiSynthesis,
    contentAnalysis,
  ] =
    await Promise.all([
      decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
      decryptOptionalText(masterKey, row.encrypted_notes),
      decryptTags(masterKey, row.encrypted_tags),
      decryptOptionalText(masterKey, row.encrypted_issuer),
      decryptOptionalText(masterKey, row.encrypted_transcript),
      decryptOptionalText(masterKey, row.encrypted_extracted_text),
      decryptStructuredFields(masterKey, row.encrypted_structured_fields),
      decryptOptionalText(masterKey, row.encrypted_ai_synthesis),
      decryptContentAnalysis(masterKey, row.encrypted_content_analysis),
    ]);

  return {
    id: row.id,
    filename: bytesToUtf8(filenameBytes),
    mimeType: row.mime_type,
    size: row.size,
    categoryId: row.category_id,
    relatedAssetId: row.related_asset_id,
    dossierIds,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    wrappedDocumentKey: row.wrapped_document_key,
    expiresAt: row.expires_at,
    notes,
    tags,
    issuer,
    transcript,
    extractedText,
    extractedAt: row.extracted_at,
    hasThumbnail: row.has_thumbnail,
    deletedAt: row.deleted_at,
    purgeAt: row.purge_at,
    aiExtractionExcluded: row.ai_extraction_excluded,
    structuredFields,
    aiSynthesis,
    aiSynthesisGeneratedAt: row.ai_synthesis_generated_at,
    contentAnalysis,
    analysisStatus: isAnalysisStatus(row.analysis_status) ? row.analysis_status : null,
    analysisUpdatedAt: row.analysis_updated_at,
  };
}

type DocumentSummaryRow = Omit<
  DocumentRow,
  "encrypted_transcript" | "encrypted_extracted_text" | "encrypted_ai_synthesis" | "encrypted_content_analysis"
>;

async function toDocumentSummary(
  masterKey: CryptoKey,
  row: DocumentSummaryRow,
  dossierIds: string[],
): Promise<DocumentSummary> {
  const [filenameBytes, notes, tags, issuer, structuredFields] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
    decryptOptionalText(masterKey, row.encrypted_notes),
    decryptTags(masterKey, row.encrypted_tags),
    decryptOptionalText(masterKey, row.encrypted_issuer),
    decryptStructuredFields(masterKey, row.encrypted_structured_fields),
  ]);

  return {
    id: row.id,
    filename: bytesToUtf8(filenameBytes),
    mimeType: row.mime_type,
    size: row.size,
    categoryId: row.category_id,
    relatedAssetId: row.related_asset_id,
    dossierIds,
    createdAt: row.created_at,
    storagePath: row.storage_path,
    wrappedDocumentKey: row.wrapped_document_key,
    expiresAt: row.expires_at,
    notes,
    tags,
    issuer,
    extractedAt: row.extracted_at,
    hasThumbnail: row.has_thumbnail,
    deletedAt: row.deleted_at,
    purgeAt: row.purge_at,
    aiExtractionExcluded: row.ai_extraction_excluded,
    structuredFields,
    aiSynthesisGeneratedAt: row.ai_synthesis_generated_at,
    analysisStatus: isAnalysisStatus(row.analysis_status) ? row.analysis_status : null,
    analysisUpdatedAt: row.analysis_updated_at,
  };
}

/** null in -> null out: nessuna miniatura da cifrare. */
async function encryptThumbnail(masterKey: CryptoKey, thumbnail: Blob | null): Promise<string | null> {
  if (!thumbnail) return null;
  const bytes = new Uint8Array(await thumbnail.arrayBuffer());
  return serializeEnvelope(await encryptBytes(masterKey, bytes));
}

/** Documenti dell'utente, decifrati client-side; un documento nel Cestino non compare qui (v. listTrashedDocuments). */
export async function listDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  // I collegamenti ai fascicoli si leggono insieme ai documenti, non dopo: un viaggio di rete in meno a ogni caricamento.
  const [{ data, error }, dossierIdsByDocument] = await Promise.all([
    supabase
      .from("documents")
      .select(DOCUMENT_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    listAllDossierLinks(supabase),
  ]);

  if (error) {
    throw new Error(`Impossibile caricare i documenti: ${error.message}`);
  }

  const rows = data ?? [];
  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/**
 * Come `listDocuments`, ma senza scaricare né decifrare testo letto, trascrizione, sintesi e analisi di ogni
 * documento: per gli elenchi, i conteggi e i selettori che non li mostrano. Un documento nel Cestino non compare.
 */
export async function listDocumentSummaries(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentSummary[]> {
  const [{ data, error }, dossierIdsByDocument] = await Promise.all([
    supabase
      .from("documents")
      .select(DOCUMENT_SUMMARY_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    listAllDossierLinks(supabase),
  ]);

  if (error) {
    throw new Error(`Impossibile caricare i documenti: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as DocumentSummaryRow[];
  return Promise.all(
    rows.map((row) => toDocumentSummary(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/** Un solo documento, per la sua scheda: non serve scaricare e decifrare tutti gli altri. `null` se non esiste, è nel Cestino o non è dell'utente. */
export async function getDocumentById(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  id: string,
): Promise<DocumentListItem | null> {
  const [{ data, error }, dossierIdsByDocument] = await Promise.all([
    supabase.from("documents").select(DOCUMENT_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle(),
    listDossierIdsForDocuments(supabase, [id]),
  ]);

  if (error) {
    throw new Error(`Impossibile caricare il documento: ${error.message}`);
  }
  if (!data) return null;

  return toDocumentListItem(masterKey, data, dossierIdsByDocument.get(id) ?? []);
}

/** Solo i documenti nel Cestino --- v. moveDocumentsToTrash/restoreDocuments. Ordinati dal più recente eliminato, non da quando erano stati creati. */
export async function listTrashedDocuments(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentListItem[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare il cestino: ${error.message}`);
  }

  const rows = data ?? [];
  const dossierIdsByDocument = await listDossierIdsForDocuments(supabase, rows.map((row) => row.id));

  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/** Documenti per id (es. allegati di una capsula, FASE 8); id non più esistenti/altrui sono omessi in silenzio. */
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

  const rows = data ?? [];
  const dossierIdsByDocument = await listDossierIdsForDocuments(supabase, rows.map((row) => row.id));

  return Promise.all(
    rows.map((row) => toDocumentListItem(masterKey, row, dossierIdsByDocument.get(row.id) ?? [])),
  );
}

/** Cifra il file client-side e carica solo cifrato: il payload in Storage, tutto il resto sulla riga `documents`. */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  file: File,
  metadata: DocumentMetadataInput,
  options: UploadOptions = {},
): Promise<string> {
  const { title, extraction, onPhase } = options;
  const plaintext = new Uint8Array(await file.arrayBuffer());
  const mimeType = mimeTypeOfFile(file);

  // FASE 17: testo estratto qui, mentre il contenuto è ancora in chiaro in memoria --- best-effort, un fallimento non blocca il salvataggio. `onPhase` riporta l'avanzamento (utile sull'OCR); se il form l'ha già letto (PriorExtraction) si riusa quel risultato.
  let extractedText: string | null;
  let segments: ContentSegment[] = [];
  let attempted: boolean;
  if (extraction) {
    extractedText = extraction.text;
    segments = extraction.segments ?? [];
    attempted = extraction.attempted;
  } else {
    attempted = canExtractText(mimeType);
    if (attempted) onPhase?.("reading", null);
    const content = await extractContent(plaintext, mimeType, (fraction) =>
      onPhase?.("reading", fraction),
    );
    extractedText = content?.text ?? null;
    segments = content?.segments ?? [];
  }

  // Stesso motivo del testo: il contenuto è ancora in chiaro qui, generarla dopo richiederebbe riscaricare il file intero.
  const thumbnailBlob = canHaveThumbnail(mimeType)
    ? await createThumbnail(plaintext, mimeType)
    : null;

  onPhase?.("saving", null);

  const [
    { wrappedDocumentKey, payload },
    encryptedFilename,
    encryptedNotes,
    encryptedTags,
    encryptedIssuer,
    encryptedExtractedText,
    encryptedThumbnail,
  ] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    // Il nome scelto dall'utente se c'è, altrimenti quello del file (FASE 19b lo sovrascrive col titolo ricavato).
    encryptBytes(masterKey, utf8ToBytes(title?.trim() || file.name)),
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
    encryptOptionalText(masterKey, metadata.issuer),
    encryptOptionalText(masterKey, extractedText ?? ""),
    encryptThumbnail(masterKey, thumbnailBlob),
  ]);

  const documentId = crypto.randomUUID();
  const storagePath = documentStoragePath(ownerId, documentId);

  await uploadEncryptedPayload(supabase, storagePath, serializeEnvelope(payload));

  // Best-effort, fuori dal Promise.all: una miniatura non riuscita non deve bloccare il documento.
  let hasThumbnail = false;
  if (encryptedThumbnail) {
    try {
      await uploadEncryptedThumbnail(supabase, documentThumbnailPath(storagePath), encryptedThumbnail);
      hasThumbnail = true;
    } catch (error) {
      console.warn("[thumbnail] impossibile salvare la miniatura:", error);
    }
  }

  // Stessa regola: best-effort, e solo se c'è testo (i segmenti ne sono la versione per pagina).
  let hasSegments = false;
  if (extractedText && segments.length > 0) {
    hasSegments = await saveDocumentSegments(supabase, masterKey, storagePath, segments);
  }

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
    encrypted_issuer: encryptedIssuer,
    encrypted_extracted_text: encryptedExtractedText,
    // null solo se nessun motore ha provato a leggere --- così "Leggili ora" lo ritrova.
    extracted_at: attempted ? new Date().toISOString() : null,
    has_thumbnail: hasThumbnail,
  });

  if (error) {
    // Best-effort cleanup so a failed insert doesn't leave an orphaned blob.
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    if (hasThumbnail) {
      await removeEncryptedPayload(supabase, documentThumbnailPath(storagePath)).catch(() => {});
    }
    if (hasSegments) await removeDocumentSegments(supabase, storagePath);
    throw new Error(`Impossibile salvare il documento: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created", undefined, documentRef(documentId));
  await replaceDocumentDossierLinks(supabase, ownerId, documentId, metadata.dossierIds);
  return documentId;
}

/** Nota di testo: stessa tabella/cifratura di un file --- distinta solo dal mime_type (NOTE_MIME_TYPE), che fa mostrare la UI come nota editabile invece di download. */
export async function createTextNote(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  note: TextNoteInput,
  metadata: DocumentMetadataInput,
): Promise<string> {
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename, encryptedNotes, encryptedTags, encryptedIssuer] =
    await Promise.all([
      encryptDocument(masterKey, plaintext),
      encryptBytes(masterKey, utf8ToBytes(note.title)),
      encryptOptionalText(masterKey, metadata.notes),
      encryptTags(masterKey, metadata.tags),
      encryptOptionalText(masterKey, metadata.issuer),
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
    encrypted_issuer: encryptedIssuer,
  });

  if (error) {
    await removeEncryptedPayload(supabase, storagePath).catch(() => {});
    throw new Error(`Impossibile salvare la nota: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "document_created", undefined, documentRef(documentId));
  await replaceDocumentDossierLinks(supabase, ownerId, documentId, metadata.dossierIds);
  return documentId;
}

/** Ricifra con una Document Key fresca e carica su un path NUOVO (mai sovrascrivendo) --- una lettura Storage stale altrimenti pairerebbe cifrato-vecchio con chiave-nuova, e la decifratura fallirebbe. */
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
  await logAuditEvent(supabase, ownerId, "document_updated", { change: "note" }, documentRef(doc.id));
}

/** Aggiorna titolo/categoria/scadenza/note/tag/emittente --- mai il contenuto del file. Ricifra notes/tags/issuer (e il titolo, se cambia) con la Master Key. */
export async function updateDocumentMetadata(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  metadata: DocumentMetadataInput,
): Promise<void> {
  const [encryptedNotes, encryptedTags, encryptedIssuer] = await Promise.all([
    encryptOptionalText(masterKey, metadata.notes),
    encryptTags(masterKey, metadata.tags),
    encryptOptionalText(masterKey, metadata.issuer),
  ]);

  let structuredUpdate: { encrypted_structured_fields: string | null } | undefined;
  if (metadata.structuredFields) {
    const nonEmpty = Object.fromEntries(
      Object.entries(metadata.structuredFields).filter(([, value]) => value.trim() !== ""),
    );
    structuredUpdate = { encrypted_structured_fields: await encryptStructuredFields(masterKey, nonEmpty) };
  }

  const newTitle = metadata.title?.trim();
  const titleUpdate = newTitle
    ? { encrypted_filename: serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(newTitle))) }
    : undefined;

  const { error } = await supabase
    .from("documents")
    .update({
      category_id: metadata.categoryId,
      related_asset_id: metadata.relatedAssetId,
      expires_at: metadata.expiresAt,
      encrypted_notes: encryptedNotes,
      encrypted_tags: encryptedTags,
      encrypted_issuer: encryptedIssuer,
      ...structuredUpdate,
      ...titleUpdate,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile aggiornare il documento: ${error.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Devi essere autenticato.");
  await replaceDocumentDossierLinks(supabase, user.id, documentId, metadata.dossierIds);
  await logAuditEvent(supabase, user.id, "document_updated", { change: "details" }, documentRef(documentId));
}

/** Traccia nella cronologia del documento un salvataggio che non passa da updateDocumentMetadata. */
async function logDocumentChange(
  supabase: SupabaseClient<Database>,
  documentId: string,
  metadata: Pick<AuditEventMetadata, "change" | "excluded">,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await logAuditEvent(supabase, user.id, "document_updated", metadata, documentRef(documentId));
}

function documentRef(id: string, encryptedLabel?: string): AuditEntityRef {
  return { type: "document", id, encryptedLabel };
}

/** Scritto a mano oggi (v. domain/transcription); un motore reale in futuro cambierebbe solo cosa riempie il campo, non questa funzione. */
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

  await logDocumentChange(supabase, documentId, { change: "transcript" });
}

/** Sostituisce sempre il valore precedente --- non è una proposta (nessun accetta/modifica/rifiuta), solo l'ultima lettura d'insieme di Claude, come extractedText/extractedAt per il testo locale. */
export async function saveAISynthesis(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  synthesis: string,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({
      encrypted_ai_synthesis: await encryptOptionalText(masterKey, synthesis),
      ai_synthesis_generated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare la sintesi: ${error.message}`);
  }

  await logDocumentChange(supabase, documentId, { change: "ai_reading" });
}

/** Sostituisce l'intera lettura precedente: è la fotografia più recente, salvata dopo ogni blocco così un'interruzione non butta il lavoro già pagato. */
export async function saveContentAnalysis(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  analysis: PersistedContentAnalysis,
  status: AnalysisStatus,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({
      encrypted_content_analysis: serializeEnvelope(
        await encryptBytes(masterKey, utf8ToBytes(JSON.stringify(analysis))),
      ),
      analysis_status: status,
      analysis_updated_at: analysis.updatedAt,
    })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare la lettura di Hinthia: ${error.message}`);
  }
}

/** FASE 22: esclude/riammette un documento dall'analisi Claude --- vince sempre su qualunque consenso di categoria. */
export async function updateDocumentAIExtractionExclusion(
  supabase: SupabaseClient<Database>,
  documentId: string,
  excluded: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ ai_extraction_excluded: excluded })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare l'esclusione: ${error.message}`);
  }

  await logDocumentChange(supabase, documentId, { change: "ai_exclusion", excluded });
}

/** `null` se il tipo non ha miniatura, il documento è pre-esistente, o l'upload a suo tempo è fallito --- chi chiama ricade sul file intero. */
export async function downloadThumbnail(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: Pick<DocumentListItem, "storagePath" | "hasThumbnail">,
): Promise<Blob | null> {
  if (!doc.hasThumbnail) return null;

  const serialized = await downloadOptionalEncryptedPayload(
    supabase,
    documentThumbnailPath(doc.storagePath),
  );
  if (!serialized) return null;

  try {
    const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
    return new Blob([bytes], { type: "image/jpeg" });
  } catch (error) {
    console.warn("[thumbnail] impossibile decifrare la miniatura:", error);
    return null;
  }
}

/** Downloads and decrypts a document's content client-side. */
export async function downloadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: Pick<DocumentSummary, "storagePath" | "wrappedDocumentKey" | "filename" | "mimeType">,
): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }> {
  const serializedPayload = await downloadEncryptedPayload(supabase, doc.storagePath);

  const encrypted: EncryptedDocument = {
    wrappedDocumentKey: parseEnvelope(doc.wrappedDocumentKey),
    payload: parseEnvelope(serializedPayload),
  };
  const bytes = await decryptDocument(masterKey, encrypted);

  return { filename: doc.filename, mimeType: doc.mimeType, bytes };
}

/** FASE 17b: contenuti pre-estrazione (extractedAt null, tipo leggibile) --- gli unici senza ricerca dentro il file. */
export function documentsAwaitingExtraction<T extends Pick<DocumentSummary, "extractedAt" | "mimeType">>(
  documents: T[],
): T[] {
  return documents.filter((doc) => doc.extractedAt === null && canExtractText(doc.mimeType));
}

async function readStoredExtractedText(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  id: string,
): Promise<string> {
  const { data } = await supabase.from("documents").select("encrypted_extracted_text").eq("id", id).maybeSingle();
  return decryptOptionalText(masterKey, data?.encrypted_extracted_text ?? null);
}

/** Rilegge un contenuto già archiviato. Marca `extracted_at` anche a vuoto, per distinguere "letto, senza testo" da "mai letto". */
export async function extractTextForExistingDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  doc: Pick<
    DocumentSummary,
    "id" | "storagePath" | "wrappedDocumentKey" | "filename" | "mimeType" | "hasThumbnail" | "extractedAt"
  > & { extractedText?: string },
  onProgress?: (fraction: number) => void,
): Promise<{ foundText: boolean }> {
  const { bytes } = await downloadDocument(supabase, masterKey, doc);
  const content = await extractContent(bytes, doc.mimeType, onProgress);
  const text = content?.text ?? null;
  const segments = content?.segments ?? [];

  const update: {
    encrypted_extracted_text: string | null;
    extracted_at: string;
    has_thumbnail?: boolean;
    encrypted_content_analysis?: null;
    analysis_status?: null;
    analysis_updated_at?: null;
  } = {
    encrypted_extracted_text: await encryptOptionalText(masterKey, text ?? ""),
    extracted_at: new Date().toISOString(),
  };

  // Una lettura di Hinthia riguarda il testo di allora: se il testo cambia non vale più, e non va mostrata come attuale.
  // Chi chiama con un elenco leggero non ha il testo di prima: si rilegge solo se serve (mai letto = nessun testo né analisi).
  const previousText =
    doc.extractedText ??
    (doc.extractedAt === null ? "" : await readStoredExtractedText(supabase, masterKey, doc.id));
  if ((text ?? "") !== previousText) {
    update.encrypted_content_analysis = null;
    update.analysis_status = null;
    update.analysis_updated_at = null;
  }

  // Backfill della miniatura, quasi a costo zero qui: i byte in chiaro servono già per il testo. Nessuna migrazione forzata su tutto l'archivio, si aggancia solo a "Leggili ora"/"Rileggi".
  if (!doc.hasThumbnail && canHaveThumbnail(doc.mimeType)) {
    const thumbnail = await createThumbnail(bytes, doc.mimeType);
    if (thumbnail) {
      try {
        const encryptedThumbnail = await encryptThumbnail(masterKey, thumbnail);
        await uploadEncryptedThumbnail(
          supabase,
          documentThumbnailPath(doc.storagePath),
          encryptedThumbnail!,
        );
        update.has_thumbnail = true;
      } catch (error) {
        console.warn("[thumbnail] impossibile salvare la miniatura:", error);
      }
    }
  }

  // Prima della riga, come la miniatura: se la scrittura dei segmenti fallisce il documento resta valido, solo senza pagine.
  if (text && segments.length > 0) {
    await saveDocumentSegments(supabase, masterKey, doc.storagePath, segments);
  } else {
    await removeDocumentSegments(supabase, doc.storagePath);
  }

  const { error } = await supabase.from("documents").update(update).eq("id", doc.id);

  if (error) {
    throw new Error(`Impossibile salvare il testo estratto: ${error.message}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await logAuditEvent(
      supabase,
      user.id,
      "document_text_read",
      { reread: doc.extractedAt !== null },
      documentRef(doc.id),
    );
  }

  return { foundText: Boolean(text) };
}

/** Elimina per sempre (Storage + riga), senza ripristino --- solo dal cron di purga o "Elimina ora" nel Cestino, mai da "Elimina" in Archivio (che sposta nel cestino, v. sotto). */
export async function deleteDocument(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  doc: Pick<DocumentListItem, "id" | "storagePath" | "hasThumbnail">,
): Promise<void> {
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

/** Traccia nella cronologia del documento che è stato scaricato --- chiamata dai punti in cui lo sceglie l'utente, non da `downloadDocument` (usato anche per anteprime ed esportazioni). */
export async function logDocumentDownloaded(
  supabase: SupabaseClient<Database>,
  documentId: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await logAuditEvent(supabase, user.id, "document_downloaded", undefined, documentRef(documentId));
}
