import { mimeTypeOfFile } from "@/lib/file-mime";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { encryptBytes, encryptDocument, serializeEnvelope, utf8ToBytes } from "@/lib/crypto";
import { documentStoragePath, documentThumbnailPath, removeEncryptedPayload, uploadEncryptedPayload, uploadEncryptedThumbnail } from "@/lib/storage/documents-bucket";
import { logAuditEvent } from "@/lib/audit/log-event";
import { type AnalysisStatus, type PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import { replaceDocumentDossierLinks } from "@/domain/dossiers/repository";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import type { ContentSegment } from "@/domain/extraction/types";
import { removeDocumentSegments, saveDocumentSegments } from "@/domain/documents/segments";
import { canHaveThumbnail, createThumbnail } from "@/lib/thumbnail";
import type { DocumentListItem, DocumentMetadataInput, TextNoteInput } from "@/domain/documents/types";
import { encryptOptionalText } from "@/lib/crypto/optional-text";
import { invalidateVault, VAULT } from "@/lib/vault-store";
import { encryptStructuredFields, encryptThumbnail, logDocumentChange, documentRef } from "@/domain/documents/row-mapping";

/** V. uploadDocument, `onPhase` --- "reading" può durare da secondi a decine su OCR di una foto. */
export type UploadPhase = "reading" | "saving";

/** `null` = non stimabile (mostra attesa senza percentuale), non "zero" (v. FASE 17c). */
type UploadPhaseListener = (phase: UploadPhase, progress: number | null) => void;

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

/** Cifra il file client-side e carica solo cifrato: il payload in Storage, tutto il resto sulla riga `documents`. */
export async function uploadDocument(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  file: File,
  metadata: DocumentMetadataInput,
  options: UploadOptions = {},
): Promise<string> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
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
    encryptedIssuer,
    encryptedExtractedText,
    encryptedThumbnail,
  ] = await Promise.all([
    encryptDocument(masterKey, plaintext),
    // Il nome scelto dall'utente se c'è, altrimenti quello del file (FASE 19b lo sovrascrive col titolo ricavato).
    encryptBytes(masterKey, utf8ToBytes(title?.trim() || file.name)),
    encryptOptionalText(masterKey, metadata.notes),
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
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  const plaintext = utf8ToBytes(note.body);
  const [{ wrappedDocumentKey, payload }, encryptedFilename, encryptedNotes, encryptedIssuer] =
    await Promise.all([
      encryptDocument(masterKey, plaintext),
      encryptBytes(masterKey, utf8ToBytes(note.title)),
      encryptOptionalText(masterKey, metadata.notes),
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
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
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

/** Aggiorna titolo/categoria/scadenza/note/emittente --- mai il contenuto del file. Ricifra notes/issuer (e il titolo, se cambia) con la Master Key. */
export async function updateDocumentMetadata(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  metadata: DocumentMetadataInput,
): Promise<void> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  const [encryptedNotes, encryptedIssuer] = await Promise.all([
    encryptOptionalText(masterKey, metadata.notes),
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

/** Sostituisce sempre il valore precedente --- non è una proposta (nessun accetta/modifica/rifiuta), solo l'ultima lettura d'insieme di Claude, come extractedText/extractedAt per il testo locale. */
export async function saveAISynthesis(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  documentId: string,
  synthesis: string,
): Promise<void> {
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
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
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
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
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
  const { error } = await supabase
    .from("documents")
    .update({ ai_extraction_excluded: excluded })
    .eq("id", documentId);

  if (error) {
    throw new Error(`Impossibile salvare l'esclusione: ${error.message}`);
  }

  await logDocumentChange(supabase, documentId, { change: "ai_exclusion", excluded });
}
