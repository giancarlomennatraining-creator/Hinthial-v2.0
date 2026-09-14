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
  "id, encrypted_name, encrypted_email, encrypted_first_name, encrypted_last_name, avatar_path, role, status, is_guardian, linked_user_id, created_at";

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
    isGuardian: row.is_guardian,
    linkedUserId: row.linked_user_id,
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

  return Promise.all((data ?? []).map((row) => toFriendListItem(supabase, masterKey, row)));
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

/**
 * Re-encrypts name/email/first/last name and updates the plaintext role
 * --- same fields as createFriend, no status change.
 *
 * `emailChanged` (il chiamante lo sa già, avendo sia l'email decifrata
 * originale sia quella appena scritta): quando true, azzera anche
 * `linked_user_id` --- il collegamento a un account Hinthial è per
 * definizione legato a QUELLA email, e resterebbe altrimenti agganciato
 * per sempre all'account sbagliato (v. richiesta utente: cambiando
 * l'email di un amico già collegato, badge "✓ Su Hinthial" e foto reale
 * restavano quelli di prima). Non tocca invece `avatar_path` --- una
 * foto caricata a mano non ha nulla a che fare con l'email. Il
 * ricollegamento alla nuova email, se corrisponde a un account, avviene
 * da sé al prossimo caricamento di Amici (v. FriendsPanel.tsx,
 * checkLinkedAccounts, che riprova solo per chi non ha già un
 * linked_user_id): nessuna nuova verifica va fatta qui.
 */
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

/**
 * Carica/sostituisce la foto di un amico, caricata a mano dal
 * proprietario --- in chiaro, stesso principio già accettato per
 * l'avatar del proprio profilo (v. domain/profile/repository.ts,
 * updateAvatar, stesso schema). Vince sempre sulla foto reale
 * dell'account collegato, quando c'è (v. FriendsPanel.tsx).
 */
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

/**
 * Path Storage della foto profilo reale dell'account Hinthial collegato
 * a un amico (v. migrazione friend_name_avatar, get_linked_friend_avatar_path)
 * --- null se l'amico non è collegato o quell'account non ha una foto.
 * Mai l'intera riga profiles: solo questo, per non sovraesporre
 * preferenze/consensi altrui a chi ha semplicemente salvato un'email
 * come amico.
 */
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

/**
 * FASE C1 del piano di condivisione capsule --- la chiave pubblica ECDH
 * (v. lib/crypto/keypair.ts) dell'account collegato a un amico, o null
 * se non è collegato o non ha ancora una chiave (v. migrazione
 * account_keypair, get_linked_friend_public_key). Serve per cifrare una
 * capsula appositamente per lui al momento della condivisione (v.
 * domain/capsules/repository.ts, shareCapsule).
 */
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

/**
 * FASE A del piano di condivisione capsule --- verifica se una singola
 * email (già decifrata lato client per UN amico) corrisponde a un
 * account Hinthial registrato. Passa dalla funzione Postgres
 * `lookup_friend_account` (v. migrazione friend_account_lookup):
 * l'unica che può confrontarla con `auth.users`, mai raggiungibile
 * direttamente dal client. Nessun elenco, nessun confronto bulk --- una
 * chiamata per amico, con un tetto giornaliero lato server contro
 * l'enumerazione di account.
 */
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
