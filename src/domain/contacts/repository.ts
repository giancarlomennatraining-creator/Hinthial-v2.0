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
import type {
  TrustedContactInput,
  TrustedContactListItem,
  TrustedContactStatus,
} from "@/domain/contacts/types";

const TRUSTED_CONTACT_COLUMNS =
  "id, encrypted_name, encrypted_email, role, status, created_at";

type TrustedContactRow = {
  id: string;
  encrypted_name: string;
  encrypted_email: string;
  role: string;
  status: TrustedContactStatus;
  created_at: string;
};

async function toTrustedContactListItem(
  masterKey: CryptoKey,
  row: TrustedContactRow,
): Promise<TrustedContactListItem> {
  const [nameBytes, emailBytes] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_name)),
    decryptBytes(masterKey, parseEnvelope(row.encrypted_email)),
  ]);

  return {
    id: row.id,
    name: bytesToUtf8(nameBytes),
    email: bytesToUtf8(emailBytes),
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Lists the current user's trusted contacts (most recent first),
 * decrypting name/email client-side with the Master Key.
 */
export async function listTrustedContacts(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<TrustedContactListItem[]> {
  const { data, error } = await supabase
    .from("trusted_contacts")
    .select(TRUSTED_CONTACT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i contatti fiduciari: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toTrustedContactListItem(masterKey, row)));
}

/**
 * Fetches a specific set of trusted contacts by id (e.g. a capsule's
 * recipients, FASE 8), decrypting each client-side. Ids that no longer
 * exist (or belong to someone else, filtered out by RLS) are silently
 * omitted --- callers should treat a shorter result as "some referenced
 * contacts are gone", not an error.
 */
export async function getTrustedContactsByIds(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ids: string[],
): Promise<TrustedContactListItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("trusted_contacts")
    .select(TRUSTED_CONTACT_COLUMNS)
    .in("id", ids);

  if (error) {
    throw new Error(`Impossibile caricare i contatti collegati: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toTrustedContactListItem(masterKey, row)));
}

export async function createTrustedContact(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: TrustedContactInput,
): Promise<void> {
  const [encryptedName, encryptedEmail] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
  ]);

  const { error } = await supabase.from("trusted_contacts").insert({
    owner_id: ownerId,
    encrypted_name: serializeEnvelope(encryptedName),
    encrypted_email: serializeEnvelope(encryptedEmail),
    role: input.role,
  });

  if (error) {
    throw new Error(`Impossibile aggiungere il contatto fiduciario: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "trusted_contact_added");
}

/** Re-encrypts name/email and updates the plaintext role --- same fields as createTrustedContact, no status change. */
export async function updateTrustedContact(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  contactId: string,
  input: TrustedContactInput,
): Promise<void> {
  const [encryptedName, encryptedEmail] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
  ]);

  const { error } = await supabase
    .from("trusted_contacts")
    .update({
      encrypted_name: serializeEnvelope(encryptedName),
      encrypted_email: serializeEnvelope(encryptedEmail),
      role: input.role,
    })
    .eq("id", contactId);

  if (error) {
    throw new Error(`Impossibile aggiornare il contatto fiduciario: ${error.message}`);
  }
}

/**
 * Changes a trusted contact's status --- "Segna come attivo" (pending ->
 * active) or "Revoca" (-> revoked). Doesn't grant/revoke any actual data
 * access: no unlock logic exists yet (FASE 7 is data-structure-only).
 */
export async function setTrustedContactStatus(
  supabase: SupabaseClient<Database>,
  contactId: string,
  status: TrustedContactStatus,
): Promise<void> {
  const { error } = await supabase
    .from("trusted_contacts")
    .update({ status })
    .eq("id", contactId);

  if (error) {
    throw new Error(`Impossibile aggiornare lo stato del contatto: ${error.message}`);
  }
}

export async function deleteTrustedContact(
  supabase: SupabaseClient<Database>,
  contactId: string,
): Promise<void> {
  const { error } = await supabase.from("trusted_contacts").delete().eq("id", contactId);

  if (error) {
    throw new Error(`Impossibile eliminare il contatto fiduciario: ${error.message}`);
  }
}
