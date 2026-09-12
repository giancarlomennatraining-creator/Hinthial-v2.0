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
import type { FriendInput, FriendListItem, FriendStatus } from "@/domain/friends/types";

const FRIEND_COLUMNS = "id, encrypted_name, encrypted_email, role, status, is_guardian, created_at";

type FriendRow = {
  id: string;
  encrypted_name: string;
  encrypted_email: string;
  role: string;
  status: FriendStatus;
  is_guardian: boolean;
  created_at: string;
};

async function toFriendListItem(masterKey: CryptoKey, row: FriendRow): Promise<FriendListItem> {
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
    isGuardian: row.is_guardian,
    createdAt: row.created_at,
  };
}

/**
 * Lists the current user's friends (most recent first), decrypting
 * name/email client-side with the Master Key.
 */
export async function listFriends(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): Promise<FriendListItem[]> {
  const { data, error } = await supabase
    .from("friends")
    .select(FRIEND_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare gli amici: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toFriendListItem(masterKey, row)));
}

/**
 * Fetches a specific set of friends by id (e.g. a capsule's recipients,
 * FASE 8), decrypting each client-side. Ids that no longer exist (or
 * belong to someone else, filtered out by RLS) are silently omitted ---
 * callers should treat a shorter result as "some referenced friends are
 * gone", not an error.
 */
export async function getFriendsByIds(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ids: string[],
): Promise<FriendListItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from("friends").select(FRIEND_COLUMNS).in("id", ids);

  if (error) {
    throw new Error(`Impossibile caricare gli amici collegati: ${error.message}`);
  }

  return Promise.all((data ?? []).map((row) => toFriendListItem(masterKey, row)));
}

export async function createFriend(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: FriendInput,
): Promise<void> {
  const [encryptedName, encryptedEmail] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
  ]);

  const { error } = await supabase.from("friends").insert({
    owner_id: ownerId,
    encrypted_name: serializeEnvelope(encryptedName),
    encrypted_email: serializeEnvelope(encryptedEmail),
    role: input.role,
  });

  if (error) {
    throw new Error(`Impossibile aggiungere l'amico: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "friend_added");
}

/** Re-encrypts name/email and updates the plaintext role --- same fields as createFriend, no status change. */
export async function updateFriend(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  friendId: string,
  input: FriendInput,
): Promise<void> {
  const [encryptedName, encryptedEmail] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
  ]);

  const { error } = await supabase
    .from("friends")
    .update({
      encrypted_name: serializeEnvelope(encryptedName),
      encrypted_email: serializeEnvelope(encryptedEmail),
      role: input.role,
    })
    .eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }
}

/**
 * Changes a friend's status --- "Segna come attivo" (pending -> active)
 * o "Revoca" (-> revoked). Doesn't grant/revoke any actual data access:
 * no unlock logic exists yet (FASE 7 is data-structure-only).
 */
export async function setFriendStatus(
  supabase: SupabaseClient<Database>,
  friendId: string,
  status: FriendStatus,
): Promise<void> {
  const { error } = await supabase.from("friends").update({ status }).eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile aggiornare lo stato dell'amico: ${error.message}`);
  }
}

/**
 * Marca/smarca un amico come "guardiano" (Dead Man's Switch semplificato
 * per le capsule, v. domain/capsules) --- solo un flag, come lo stato:
 * nessuna conferma richiesta da parte sua, nessun accesso concesso.
 */
export async function setFriendGuardian(
  supabase: SupabaseClient<Database>,
  friendId: string,
  isGuardian: boolean,
): Promise<void> {
  const { error } = await supabase.from("friends").update({ is_guardian: isGuardian }).eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }
}

export async function deleteFriend(supabase: SupabaseClient<Database>, friendId: string): Promise<void> {
  const { error } = await supabase.from("friends").delete().eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile eliminare l'amico: ${error.message}`);
  }
}
