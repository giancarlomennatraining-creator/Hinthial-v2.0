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
import { logAuditEvent } from "@/lib/audit/log-event";
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
    // La colonna è un `text` con check a livello di database (v.
    // migrazione), non un enum Postgres --- il cast qui è sicuro perché
    // il vincolo lo garantisce lato server; non c'è un terzo valore da
    // gestire.
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

  await logAuditEvent(supabase, ownerId, "dossier_created");

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
}

/**
 * Apre o chiude un fascicolo --- un'azione a sé e non parte del form di
 * modifica (stesso schema di setReminderCompleted): un solo clic, non
 * "modifica, cambia lo stato, salva". `closed_at` si azzera riaprendo,
 * così una riapertura non lascia una data di chiusura vecchia e
 * fuorviante appesa a un fascicolo di nuovo aperto.
 */
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

/**
 * Elimina il fascicolo. I documenti collegati non vengono toccati, solo
 * scollegati (`dossier_id` ON DELETE SET NULL, v. migrazione) --- stessa
 * garanzia già data per beni e categorie.
 */
export async function deleteDossier(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  dossierId: string,
): Promise<void> {
  const { error } = await supabase.from("dossiers").delete().eq("id", dossierId);

  if (error) {
    throw new Error(`Impossibile eliminare il fascicolo: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "dossier_deleted");
}
