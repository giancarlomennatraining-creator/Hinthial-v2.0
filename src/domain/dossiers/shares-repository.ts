import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  bytesToUtf8,
  decryptBytes,
  encryptBytes,
  exportKeyRaw,
  generateSymmetricKey,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
} from "@/lib/crypto";
import { logAuditEvent } from "@/lib/audit/log-event";
import { downloadDocument } from "@/domain/documents/repository";
import { removeShareFiles, shareFilePath, uploadShareFile } from "@/lib/storage/dossier-shares-bucket";
import type { DocumentSummary } from "@/domain/documents/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import {
  buildManifest,
  expiresAtFor,
  keyToFragment,
  MAX_SHARE_LABEL_LENGTH,
  shareUrl,
  validateShareSelection,
  type ShareAccess,
  type ShareExpiryId,
} from "@/domain/dossiers/sharing";

/**
 * Chi condivide: crea il link, lo ricopia, lo revoca, vede gli accessi. Il dispositivo decifra i documenti scelti e li
 * ricifra con una chiave nuova che sta solo nel link (v. migrazione dossier_shares): il server non la vede mai.
 */

type ShareableDocument = Pick<
  DocumentSummary,
  "id" | "filename" | "mimeType" | "size" | "createdAt" | "storagePath" | "wrappedDocumentKey"
>;

export interface CreateShareInput {
  dossier: DossierListItem;
  documents: ShareableDocument[];
  /** Per chi è il link ("Notaio Rossi"): serve solo a riconoscerlo. */
  label: string;
  expiryId: ShareExpiryId;
  allowDownload: boolean;
  includeSummary: boolean;
  includePhase: boolean;
  /** L'indirizzo del sito, per comporre il link (es. https://hinthial.vercel.app). */
  origin: string;
}

export interface CreatedShare {
  shareId: string;
  url: string;
  expiresAt: string;
}

/** `onProgress(fatti, totali)`: un passo per documento, poi l'indice. Se qualcosa va storto le copie già caricate si tolgono. */
export async function createDossierShare(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: CreateShareInput,
  onProgress?: (done: number, total: number) => void,
  now: Date = new Date(),
): Promise<CreatedShare> {
  const problem = validateShareSelection(input.documents);
  if (problem) throw new Error(problem);

  const shareId = crypto.randomUUID();
  const shareKey = await generateSymmetricKey();
  const rawKey = await exportKeyRaw(shareKey);
  const total = input.documents.length + 1;
  let done = 0;
  onProgress?.(done, total);

  try {
    for (const doc of input.documents) {
      const { bytes } = await downloadDocument(supabase, masterKey, doc);
      const envelope = await encryptBytes(shareKey, new Uint8Array(bytes));
      await uploadShareFile(supabase, shareFilePath(ownerId, shareId, doc.id), serializeEnvelope(envelope));
      done += 1;
      onProgress?.(done, total);
    }

    const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", ownerId).maybeSingle();
    const sharedBy = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

    const manifest = buildManifest({
      title: input.dossier.title,
      description: input.dossier.description,
      sharedBy,
      sharedAt: now.toISOString(),
      phase: input.includePhase ? input.dossier.phases : null,
      summary: input.includeSummary ? (input.dossier.summary?.text ?? null) : null,
      documents: input.documents.map((d) => ({ id: d.id, name: d.filename, mimeType: d.mimeType, size: d.size, createdAt: d.createdAt })),
    });
    const encryptedManifest = serializeEnvelope(await encryptBytes(shareKey, utf8ToBytes(JSON.stringify(manifest))));
    const encryptedLinkKey = serializeEnvelope(await encryptBytes(masterKey, rawKey));
    const label = input.label.trim().slice(0, MAX_SHARE_LABEL_LENGTH);
    const encryptedLabel = label ? serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(label))) : null;
    const expiresAt = expiresAtFor(input.expiryId, now);

    const { error } = await supabase.from("dossier_shares").insert({
      id: shareId,
      owner_id: ownerId,
      dossier_id: input.dossier.id,
      encrypted_label: encryptedLabel,
      encrypted_link_key: encryptedLinkKey,
      encrypted_manifest: encryptedManifest,
      allow_download: input.allowDownload,
      document_count: input.documents.length,
      expires_at: expiresAt,
    });
    if (error) throw new Error(`Impossibile creare il link: ${error.message}`);

    done += 1;
    onProgress?.(done, total);
    await logAuditEvent(supabase, ownerId, "dossier_shared", undefined, { type: "dossier", id: input.dossier.id });

    return { shareId, url: shareUrl(input.origin, shareId, keyToFragment(rawKey)), expiresAt };
  } catch (err) {
    // Le copie già caricate non devono restare orfane.
    await removeShareFiles(supabase, ownerId, shareId).catch(() => undefined);
    throw err;
  }
}

export interface DossierShare {
  id: string;
  label: string;
  allowDownload: boolean;
  documentCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  accesses: ShareAccess[];
  /** Il link intero, ricomposto con la chiave decifrata: per ricopiarlo. null se la chiave non si decifra. */
  url: string | null;
}

/** I link di un fascicolo, dal più recente, con gli accessi. */
export async function listDossierShares(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
  origin: string,
): Promise<DossierShare[]> {
  const { data, error } = await supabase
    .from("dossier_shares")
    .select("id, encrypted_label, encrypted_link_key, allow_download, document_count, expires_at, revoked_at, created_at")
    .eq("dossier_id", dossierId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i link di condivisione: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: accessRows, error: accessError } = await supabase
    .from("dossier_share_accesses")
    .select("share_id, kind, document_id, accessed_at")
    .in("share_id", rows.map((r) => r.id))
    .order("accessed_at", { ascending: false });
  if (accessError) {
    throw new Error(`Impossibile caricare gli accessi: ${accessError.message}`);
  }

  return Promise.all(
    rows.map(async (row): Promise<DossierShare> => {
      let label = "";
      let url: string | null = null;
      try {
        if (row.encrypted_label) label = bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(row.encrypted_label)));
        const raw = await decryptBytes(masterKey, parseEnvelope(row.encrypted_link_key));
        url = shareUrl(origin, row.id, keyToFragment(raw));
      } catch {
        // Un link la cui chiave non si decifra resta in elenco, solo senza "Copia".
      }
      return {
        id: row.id,
        label,
        allowDownload: row.allow_download,
        documentCount: row.document_count,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
        url,
        accesses: (accessRows ?? [])
          .filter((a) => a.share_id === row.id)
          .map((a) => ({ kind: a.kind === "document" ? "document" : "open", documentId: a.document_id, accessedAt: a.accessed_at })),
      };
    }),
  );
}

/** Revoca subito: il link smette di funzionare e le copie cifrate si tolgono. */
export async function revokeDossierShare(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dossierId: string,
  shareId: string,
): Promise<void> {
  const { error } = await supabase
    .from("dossier_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId);
  if (error) {
    throw new Error(`Impossibile revocare il link: ${error.message}`);
  }

  await removeShareFiles(supabase, ownerId, shareId);
  await supabase.from("dossier_shares").update({ files_purged_at: new Date().toISOString() }).eq("id", shareId);
  await logAuditEvent(supabase, ownerId, "dossier_share_revoked", undefined, { type: "dossier", id: dossierId });
}
