import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  encryptBytes,
  decryptBytes,
  parseEnvelope,
  serializeEnvelope,
  utf8ToBytes,
  bytesToUtf8,
} from "@/lib/crypto";
import { logAuditEvent, logAuditEventForCurrentUser } from "@/lib/audit/log-event";
import type { DossierInput, DossierListItem, DossierStatus } from "@/domain/dossiers/types";

const DOSSIER_COLUMNS =
  "id, encrypted_title, encrypted_description, status, created_at, closed_at";

type DossierRow = {
  id: string;
  encrypted_title: string;
  encrypted_description: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
};

/** null/empty in -> null out --- v. domain/documents/repository.ts, encryptOptionalText. */
async function encryptOptionalText(masterKey: CryptoKey, text: string): Promise<string | null> {
  if (!text.trim()) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(text)));
}

async function decryptOptionalText(masterKey: CryptoKey, serialized: string | null): Promise<string> {
  if (!serialized) return "";
  const bytes = await decryptBytes(masterKey, parseEnvelope(serialized));
  return bytesToUtf8(bytes);
}

async function toDossierListItem(masterKey: CryptoKey, row: DossierRow): Promise<DossierListItem> {
  const [titleBytes, description] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_title)),
    decryptOptionalText(masterKey, row.encrypted_description),
  ]);

  return {
    id: row.id,
    title: bytesToUtf8(titleBytes),
    description,
    // Colonna `text` con check lato DB, non un enum Postgres --- il cast è sicuro, il vincolo lo garantisce.
    status: row.status as DossierStatus,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

/** Lists the current user's dossiers (most recent first), decrypting title/description client-side. */
export async function listDossiers(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<DossierListItem[]> {
  const { data, error } = await supabase
    .from("dossiers")
    .select(DOSSIER_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i fascicoli: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toDossierListItem(masterKey, row)));
}

/** Returns the new dossier's id. */
export async function createDossier(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: DossierInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const [encryptedTitle, encryptedDescription] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.title)),
    encryptOptionalText(masterKey, input.description),
  ]);

  const { error } = await supabase.from("dossiers").insert({
    id,
    owner_id: ownerId,
    encrypted_title: serializeEnvelope(encryptedTitle),
    encrypted_description: encryptedDescription,
  });

  if (error) {
    throw new Error(`Impossibile creare il fascicolo: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "dossier_created", undefined, { type: "dossier", id });

  return id;
}

/** Updates title/description --- never the status, v. setDossierStatus. */
export async function updateDossier(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  dossierId: string,
  input: DossierInput,
): Promise<void> {
  const [encryptedTitle, encryptedDescription] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.title)),
    encryptOptionalText(masterKey, input.description),
  ]);

  const { error } = await supabase
    .from("dossiers")
    .update({
      encrypted_title: serializeEnvelope(encryptedTitle),
      encrypted_description: encryptedDescription,
    })
    .eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile aggiornare il fascicolo: ${error.message}`);
  }

  await logAuditEventForCurrentUser(supabase, "dossier_updated", undefined, { type: "dossier", id: dossierId });
}

/** Azione a sé, un solo clic (stesso schema di setReminderCompleted) --- `closed_at` si azzera riaprendo. */
export async function setDossierStatus(
  supabase: SupabaseClient<Database>,
  dossierId: string,
  status: DossierStatus,
): Promise<void> {
  const { error } = await supabase
    .from("dossiers")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile aggiornare lo stato del fascicolo: ${error.message}`);
  }
}

/** I documenti collegati non vengono toccati, solo scollegati (ON DELETE CASCADE sulla riga di collegamento) --- come beni e categorie. */
export async function deleteDossier(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dossierId: string,
): Promise<void> {
  // Il titolo è già cifrato nella riga: lo si copia nell'evento, per riconoscere il fascicolo dopo l'eliminazione.
  const { data: titleRow } = await supabase.from("dossiers").select("encrypted_title").eq("id", dossierId).maybeSingle();

  const { error } = await supabase.from("dossiers").delete().eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile eliminare il fascicolo: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "dossier_deleted", undefined, {
    type: "dossier",
    id: dossierId,
    encryptedLabel: titleRow?.encrypted_title,
  });
}

/** FASE 20c: tabella ponte `document_dossiers` letta in un colpo solo per un insieme di documenti, non una query a testa. Id in chiaro, nessuna decifratura. */
export async function listDossierIdsForDocuments(
  supabase: SupabaseClient<Database>,
  documentIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (documentIds.length === 0) return map;

  const { data, error } = await supabase
    .from("document_dossiers")
    .select("document_id, dossier_id")
    .in("document_id", documentIds);

  if (error) {
    throw new Error(`Impossibile caricare i collegamenti ai fascicoli: ${error.message}`);
  }

  for (const row of data ?? []) {
    const existing = map.get(row.document_id);
    if (existing) existing.push(row.dossier_id);
    else map.set(row.document_id, [row.dossier_id]);
  }

  return map;
}

/**
 * Tutti i collegamenti documento-fascicolo dell'utente (le regole di accesso mostrano solo i suoi), per leggerli in
 * parallelo all'elenco dei documenti invece che dopo, con un viaggio di rete in più: con `in(ids)` bisognava aspettare
 * di conoscere gli id.
 */
export async function listAllDossierLinks(supabase: SupabaseClient<Database>): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const { data, error } = await supabase.from("document_dossiers").select("document_id, dossier_id");
  if (error) {
    throw new Error(`Impossibile caricare i collegamenti ai fascicoli: ${error.message}`);
  }
  for (const row of data ?? []) {
    const existing = map.get(row.document_id);
    if (existing) existing.push(row.dossier_id);
    else map.set(row.document_id, [row.dossier_id]);
  }
  return map;
}

/** Cancella e reinserisce l'intero insieme invece di calcolare un diff --- pochi fascicoli a documento, non vale la complessità. */
export async function replaceDocumentDossierLinks(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  documentId: string,
  dossierIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("document_dossiers")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) {
    throw new Error(`Impossibile aggiornare i fascicoli collegati: ${deleteError.message}`);
  }

  if (dossierIds.length === 0) return;

  const { error: insertError } = await supabase.from("document_dossiers").insert(
    dossierIds.map((dossierId) => ({
      document_id: documentId,
      dossier_id: dossierId,
      owner_id: ownerId,
    })),
  );

  if (insertError) {
    throw new Error(`Impossibile aggiornare i fascicoli collegati: ${insertError.message}`);
  }
}
