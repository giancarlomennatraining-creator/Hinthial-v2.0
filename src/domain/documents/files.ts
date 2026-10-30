import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { decryptBytes, decryptDocument, parseEnvelope, type EncryptedDocument } from "@/lib/crypto";
import { documentThumbnailPath, downloadEncryptedPayload, downloadOptionalEncryptedPayload, uploadEncryptedThumbnail } from "@/lib/storage/documents-bucket";
import { logAuditEvent } from "@/lib/audit/log-event";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import { removeDocumentSegments, saveDocumentSegments } from "@/domain/documents/segments";
import { canHaveThumbnail, createThumbnail } from "@/lib/thumbnail";
import type { DocumentListItem, DocumentSummary } from "@/domain/documents/types";
import { decryptOptionalText, encryptOptionalText } from "@/lib/crypto/optional-text";
import { invalidateVault, VAULT } from "@/lib/vault-store";
import { encryptThumbnail, documentRef } from "@/domain/documents/row-mapping";

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
  invalidateVault(VAULT.documents, VAULT.documentExpiries);
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

  // Una lettura di Silva riguarda il testo di allora: se il testo cambia non vale più, e non va mostrata come attuale.
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
