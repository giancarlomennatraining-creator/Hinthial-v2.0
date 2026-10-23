import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { decryptBytes, parseEnvelope, bytesToUtf8 } from "@/lib/crypto";
import type { LinkedDocumentFields } from "@/domain/assets/link-proposal";
import { listAllDossierLinks, listDossierIdsForDocuments } from "@/domain/dossiers/repository";
import type { DocumentListItem, DocumentSummary } from "@/domain/documents/types";
import { DOCUMENT_COLUMNS, DOCUMENT_SUMMARY_COLUMNS, decryptStructuredFields, toDocumentListItem, toDocumentSummary, type DocumentSummaryRow } from "@/domain/documents/row-mapping";

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
 * Come `listDocuments`, ma senza scaricare né decifrare testo letto, sintesi e analisi di ogni
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

export interface DocumentExpiry {
  id: string;
  filename: string;
  /** `YYYY-MM-DD`, come `documents.expires_at`. */
  expiresAt: string;
}

/**
 * I documenti con una data di scadenza (passaporto, polizza...), dalla più vicina: per Archivio > Scadenze, accanto alle
 * scadenze create come tali. Si decifra solo il nome del file. Un documento nel Cestino non compare.
 */
export async function listDocumentExpiries(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DocumentExpiry[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, encrypted_filename, expires_at")
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .order("expires_at", { ascending: true });

  if (error) {
    throw new Error(`Impossibile caricare le scadenze dei documenti: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      id: row.id,
      filename: bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_filename))),
      expiresAt: row.expires_at as string,
    })),
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

/**
 * I campi salvati dei documenti già collegati a un bene (tranne quello dato): da qui il bene "impara" le sue targhe e i
 * suoi numeri di polizza, v. domain/assets/link-proposal. Si decifrano solo nome e campi, non il resto del documento.
 */
export async function listAssetLinkedFields(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  excludeDocumentId: string,
): Promise<LinkedDocumentFields[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, encrypted_filename, related_asset_id, encrypted_structured_fields")
    .not("related_asset_id", "is", null)
    .neq("id", excludeDocumentId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Impossibile caricare i documenti collegati ai beni: ${error.message}`);
  }

  return Promise.all(
    (data ?? []).map(async (row) => ({
      filename: bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_filename))),
      assetId: row.related_asset_id as string,
      fields: await decryptStructuredFields(masterKey, row.encrypted_structured_fields),
    })),
  );
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
