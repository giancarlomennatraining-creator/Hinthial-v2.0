import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { encryptBytes, decryptBytes, parseEnvelope, serializeEnvelope, utf8ToBytes, bytesToUtf8 } from "@/lib/crypto";
import { logAuditEvent, type AuditEntityRef, type AuditEventMetadata } from "@/lib/audit/log-event";
import { isAnalysisStatus, parsePersistedAnalysis, type PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import type { DocumentListItem, DocumentSummary } from "@/domain/documents/types";
import { decryptOptionalText } from "@/lib/crypto/optional-text";

export const DOCUMENT_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_issuer, encrypted_extracted_text, extracted_at, has_thumbnail, deleted_at, purge_at, ai_extraction_excluded, encrypted_structured_fields, encrypted_ai_synthesis, ai_synthesis_generated_at, encrypted_content_analysis, analysis_status, analysis_updated_at, created_at";

/** Come DOCUMENT_COLUMNS, senza testo letto, sintesi e analisi: v. DocumentSummary. */
export const DOCUMENT_SUMMARY_COLUMNS =
  "id, encrypted_filename, wrapped_document_key, storage_path, mime_type, size, category_id, related_asset_id, expires_at, encrypted_notes, encrypted_issuer, extracted_at, has_thumbnail, deleted_at, purge_at, ai_extraction_excluded, encrypted_structured_fields, ai_synthesis_generated_at, analysis_status, analysis_updated_at, created_at";

export type DocumentRow = {
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
  encrypted_issuer: string | null;
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

/** Cifra un oggetto {chiave: valore} --- i campi eterogenei aperti (v. domain/proposals, kind "field"), mai le tre colonne dedicate esistenti. */
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
export async function decryptContentAnalysis(
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

export async function toDocumentListItem(
  masterKey: CryptoKey,
  row: DocumentRow,
  dossierIds: string[],
): Promise<DocumentListItem> {
  const [
    filenameBytes,
    notes,
    issuer,
    extractedText,
    structuredFields,
    aiSynthesis,
    contentAnalysis,
  ] =
    await Promise.all([
      decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
      decryptOptionalText(masterKey, row.encrypted_notes),
      decryptOptionalText(masterKey, row.encrypted_issuer),
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
    issuer,
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

export type DocumentSummaryRow = Omit<
  DocumentRow,
  "encrypted_extracted_text" | "encrypted_ai_synthesis" | "encrypted_content_analysis"
>;

export async function toDocumentSummary(
  masterKey: CryptoKey,
  row: DocumentSummaryRow,
  dossierIds: string[],
): Promise<DocumentSummary> {
  const [filenameBytes, notes, issuer, structuredFields] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_filename)),
    decryptOptionalText(masterKey, row.encrypted_notes),
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
export async function encryptThumbnail(masterKey: CryptoKey, thumbnail: Blob | null): Promise<string | null> {
  if (!thumbnail) return null;
  const bytes = new Uint8Array(await thumbnail.arrayBuffer());
  return serializeEnvelope(await encryptBytes(masterKey, bytes));
}

/** Traccia nella cronologia del documento un salvataggio che non passa da updateDocumentMetadata. */
export async function logDocumentChange(
  supabase: SupabaseClient<Database>,
  documentId: string,
  metadata: Pick<AuditEventMetadata, "change" | "excluded">,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await logAuditEvent(supabase, user.id, "document_updated", metadata, documentRef(documentId));
}

export function documentRef(id: string, encryptedLabel?: string): AuditEntityRef {
  return { type: "document", id, encryptedLabel };
}
