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
import {
  avatarPublicUrl,
  friendAvatarStoragePath,
  removeAvatarBlob,
  uploadAvatarBlob,
} from "@/lib/storage/avatars-bucket";
import type { FriendInput, FriendListItem, FriendStatus, LinkedAccountMatch } from "@/domain/friends/types";

const FRIEND_COLUMNS =
  "id, encrypted_name, encrypted_email, encrypted_first_name, encrypted_last_name, avatar_path, role, status, is_guardian, is_friend, linked_user_id, created_at";

type FriendRow = {
  id: string;
  encrypted_name: string;
  encrypted_email: string;
  encrypted_first_name: string | null;
  encrypted_last_name: string | null;
  avatar_path: string | null;
  role: string;
  status: FriendStatus;
  is_guardian: boolean;
  is_friend: boolean;
  linked_user_id: string | null;
  created_at: string;
};

/** Nome/cognome sono facoltativi (v. FriendInput) --- null nella colonna cifrata resta "" decifrato, mai un errore. */
async function decryptOptional(masterKey: CryptoKey, envelope: string | null): Promise<string> {
  if (!envelope) return "";
  return bytesToUtf8(await decryptBytes(masterKey, parseEnvelope(envelope)));
}

/** L'opposto di decryptOptional --- una stringa vuota (o solo spazi) torna null, non un inviluppo cifrato inutile. */
async function encryptOptional(masterKey: CryptoKey, value: string): Promise<string | null> {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return serializeEnvelope(await encryptBytes(masterKey, utf8ToBytes(trimmed)));
}

async function toFriendListItem(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  row: FriendRow,
): Promise<FriendListItem> {
  const [nameBytes, emailBytes, firstName, lastName] = await Promise.all([
    decryptBytes(masterKey, parseEnvelope(row.encrypted_name)),
    decryptBytes(masterKey, parseEnvelope(row.encrypted_email)),
    decryptOptional(masterKey, row.encrypted_first_name),
    decryptOptional(masterKey, row.encrypted_last_name),
  ]);

  return {
    id: row.id,
    name: bytesToUtf8(nameBytes),
    email: bytesToUtf8(emailBytes),
    firstName,
    lastName,
    avatarPath: row.avatar_path,
    /** Solo la foto caricata a mano --- quella di un account collegato si risolve altrove, di proposito (v. FriendsPanel.tsx, checkLinkedAccounts): richiede una chiamata a parte per amico, non deve rallentare né appesantire ogni caricamento dell'elenco. */
    avatarUrl: row.avatar_path ? avatarPublicUrl(supabase, row.avatar_path) : null,
    role: row.role,
    status: row.status,
    isFriend: row.is_friend,
    isGuardian: row.is_guardian,
    linkedUserId: row.linked_user_id,
    createdAt: row.created_at,
  };
}

/** Amici dell'utente, più recenti prima, nome/email decifrati client-side. */
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

  return Promise.all((data ?? []).map((row) => toFriendListItem(supabase, masterKey, row)));
}

/** Amici per id (es. destinatari di una capsula); id non più esistenti/altrui sono omessi in silenzio. */
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

  return Promise.all((data ?? []).map((row) => toFriendListItem(supabase, masterKey, row)));
}

/** Restituisce l'id del nuovo amico --- serve a CreateFriendForm per potervi caricare subito una foto (v. updateFriendAvatar), che richiede un friendId già esistente. */
export async function createFriend(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  ownerId: string,
  input: FriendInput,
): Promise<{ id: string }> {
  const [encryptedName, encryptedEmail, encryptedFirstName, encryptedLastName] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
    encryptOptional(masterKey, input.firstName),
    encryptOptional(masterKey, input.lastName),
  ]);

  const { data, error } = await supabase
    .from("friends")
    .insert({
      owner_id: ownerId,
      encrypted_name: serializeEnvelope(encryptedName),
      encrypted_email: serializeEnvelope(encryptedEmail),
      encrypted_first_name: encryptedFirstName,
      encrypted_last_name: encryptedLastName,
      role: input.role,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Impossibile aggiungere l'amico: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "friend_added");
  return { id: data.id };
}

/** Se `emailChanged`, azzera anche `linked_user_id` --- il collegamento è legato a QUELLA email; il ricollegamento avviene da sé al prossimo giro (v. FriendsPanel, checkLinkedAccounts). */
export async function updateFriend(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  friendId: string,
  input: FriendInput,
  emailChanged: boolean,
): Promise<void> {
  const [encryptedName, encryptedEmail, encryptedFirstName, encryptedLastName] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(input.name)),
    encryptBytes(masterKey, utf8ToBytes(input.email)),
    encryptOptional(masterKey, input.firstName),
    encryptOptional(masterKey, input.lastName),
  ]);

  const { error } = await supabase
    .from("friends")
    .update({
      encrypted_name: serializeEnvelope(encryptedName),
      encrypted_email: serializeEnvelope(encryptedEmail),
      encrypted_first_name: encryptedFirstName,
      encrypted_last_name: encryptedLastName,
      role: input.role,
      ...(emailChanged ? { linked_user_id: null } : {}),
    })
    .eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }
}

/** Oggi solo "Revoca" (active -> revoked) lo usa --- non concede/revoca alcun accesso reale (FASE 7 è solo struttura dati). */
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

export async function deleteFriend(supabase: SupabaseClient<Database>, friendId: string): Promise<void> {
  const { error } = await supabase.from("friends").delete().eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile eliminare l'amico: ${error.message}`);
  }
}

/** Stesso schema di profile/repository.ts updateAvatar --- vince sempre sulla foto reale dell'account collegato, quando c'è. */
export async function updateFriendAvatar(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  friendId: string,
  blob: Blob,
  previousPath: string | null,
): Promise<{ path: string; url: string }> {
  const path = friendAvatarStoragePath(ownerId, friendId);
  await uploadAvatarBlob(supabase, path, blob);

  const { error } = await supabase.from("friends").update({ avatar_path: path }).eq("id", friendId);
  if (error) {
    await removeAvatarBlob(supabase, path).catch(() => {});
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }

  if (previousPath) {
    await removeAvatarBlob(supabase, previousPath).catch(() => {});
  }

  return { path, url: avatarPublicUrl(supabase, path) };
}

/** V. updateFriendAvatar --- rimuove la foto caricata a mano; se l'amico è un account collegato, l'interfaccia torna a mostrarne la foto reale (o le iniziali, se non ne ha una). */
export async function removeFriendAvatar(
  supabase: SupabaseClient<Database>,
  friendId: string,
  currentPath: string,
): Promise<void> {
  const { error } = await supabase.from("friends").update({ avatar_path: null }).eq("id", friendId);
  if (error) {
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }

  await removeAvatarBlob(supabase, currentPath).catch(() => {});
}

/** Solo il path della foto, mai l'intera riga profiles --- per non sovraesporre preferenze/consensi altrui. */
export async function getLinkedFriendAvatarUrl(
  supabase: SupabaseClient<Database>,
  friendId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_linked_friend_avatar_path", { p_friend_id: friendId });

  if (error) {
    throw new Error(`Impossibile verificare la foto dell'amico: ${error.message}`);
  }
  return data ? avatarPublicUrl(supabase, data) : null;
}

/** FASE C1: chiave pubblica ECDH dell'account collegato, o null --- usata per cifrare una capsula per lui (v. shareCapsule). */
export async function getLinkedFriendPublicKey(
  supabase: SupabaseClient<Database>,
  friendId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_linked_friend_public_key", { p_friend_id: friendId });

  if (error) {
    throw new Error(`Impossibile verificare la chiave dell'amico: ${error.message}`);
  }
  return data ?? null;
}

/** FASE A: verifica un'email per volta via RPC Postgres (mai `auth.users` diretto), con un tetto giornaliero contro l'enumerazione. */
export async function lookupFriendAccount(
  supabase: SupabaseClient<Database>,
  email: string,
): Promise<LinkedAccountMatch | null> {
  const { data, error } = await supabase.rpc("lookup_friend_account", { target_email: email });

  if (error) {
    throw new Error(`Impossibile verificare l'account: ${error.message}`);
  }

  const match = data?.[0];
  if (!match) return null;

  return { userId: match.matched_user_id, displayName: match.matched_display_name };
}

/** Salva la corrispondenza trovata da lookupFriendAccount() --- non concede alcun accesso, solo riconoscimento. */
export async function setFriendLinkedUser(
  supabase: SupabaseClient<Database>,
  friendId: string,
  linkedUserId: string,
): Promise<void> {
  const { error } = await supabase.from("friends").update({ linked_user_id: linkedUserId }).eq("id", friendId);

  if (error) {
    throw new Error(`Impossibile aggiornare l'amico: ${error.message}`);
  }
}
