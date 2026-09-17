import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { encryptBytes, serializeEnvelope, utf8ToBytes } from "@/lib/crypto";
import { logAuditEvent } from "@/lib/audit/log-event";

/**
 * Richiesta di amicizia in arrivo --- v. migrazione friend_requests. Il
 * nome del mittente è in chiaro (letto da profiles, v. policy
 * profiles_select_by_friend_request_sender): non è un dato del vault, è
 * il display name pubblico del suo account.
 */
export interface IncomingFriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  createdAt: string;
}

/** Solo per mostrare "richiesta inviata, in attesa" sulla riga di una PERSONA già collegata. */
export interface OutgoingFriendRequest {
  recipientId: string;
  createdAt: string;
}

/**
 * Le richieste in arrivo per l'utente corrente --- RLS limita già la
 * select a `recipient_id = auth.uid()`, ma lo ripetiamo esplicitamente
 * (v. lezione imparata con le capsule condivise: più policy permissive
 * si combinano in OR, mai fidarsi della sola RLS per il filtro giusto).
 */
export async function listIncomingFriendRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<IncomingFriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, sender_email, created_at")
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare le richieste di amicizia: ${error.message}`);
  }
  if (!data || data.length === 0) return [];

  const senderIds = data.map((row) => row.sender_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", senderIds);

  if (profilesError) {
    throw new Error(`Impossibile caricare i nomi dei mittenti: ${profilesError.message}`);
  }

  const nameById = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));

  return data.map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    senderName: nameById.get(row.sender_id) ?? "Un utente Hinthial",
    senderEmail: row.sender_email,
    createdAt: row.created_at,
  }));
}

/** Le richieste che l'utente corrente ha già mandato e sono ancora in sospeso --- per mostrare "in attesa" invece del tasto "Richiedi amicizia". */
export async function listOutgoingPendingFriendRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OutgoingFriendRequest[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("recipient_id, created_at")
    .eq("sender_id", userId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Impossibile caricare le richieste inviate: ${error.message}`);
  }
  return (data ?? []).map((row) => ({ recipientId: row.recipient_id, createdAt: row.created_at }));
}

/**
 * Invia una richiesta di amicizia --- solo per una PERSONA già collegata
 * a un account Hinthial (v. FriendsPanel, tasto "Richiedi amicizia").
 * `senderEmail` è quella della SESSIONE corrente (mai quella cifrata
 * della PERSONA nella rubrica): serve al destinatario, se accetta, per
 * creare la propria riga cifrata di questo amico (v. acceptFriendRequest).
 */
export async function sendFriendRequest(
  supabase: SupabaseClient<Database>,
  senderId: string,
  senderEmail: string,
  recipientId: string,
): Promise<void> {
  const { error } = await supabase.from("friend_requests").insert({
    sender_id: senderId,
    recipient_id: recipientId,
    sender_email: senderEmail,
  });

  if (error) {
    throw new Error(`Impossibile inviare la richiesta di amicizia: ${error.message}`);
  }

  await logAuditEvent(supabase, senderId, "friend_request_sent");
}

/**
 * Accetta una richiesta --- la funzione Postgres si occupa già di
 * marcare `is_friend = true` su ENTRAMBE le righe "amico" che esistono
 * già (v. migrazione friend_requests, accept_friend_request); qui, in
 * più, ci si assicura che il DESTINATARIO abbia una propria riga cifrata
 * per il mittente, creandola se non esisteva ancora --- serve la master
 * key perché nome/email dell'amico restano cifrati per-proprietario,
 * come ogni altra riga di friends.
 */
export async function acceptFriendRequest(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  recipientId: string,
  request: IncomingFriendRequest,
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("accept_friend_request", { request_id: request.id });
  if (rpcError) {
    throw new Error(`Impossibile accettare la richiesta: ${rpcError.message}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("friends")
    .select("id")
    .eq("owner_id", recipientId)
    .eq("linked_user_id", request.senderId)
    .limit(1);

  if (existingError) {
    throw new Error(`Impossibile verificare l'amico esistente: ${existingError.message}`);
  }
  if (existing && existing.length > 0) return;

  const [encryptedName, encryptedEmail] = await Promise.all([
    encryptBytes(masterKey, utf8ToBytes(request.senderName)),
    encryptBytes(masterKey, utf8ToBytes(request.senderEmail)),
  ]);

  const { error: insertError } = await supabase.from("friends").insert({
    owner_id: recipientId,
    encrypted_name: serializeEnvelope(encryptedName),
    encrypted_email: serializeEnvelope(encryptedEmail),
    role: "Amico",
    is_friend: true,
    linked_user_id: request.senderId,
  });

  if (insertError) {
    throw new Error(`Impossibile creare la riga amico: ${insertError.message}`);
  }
}

export async function rejectFriendRequest(supabase: SupabaseClient<Database>, requestId: string): Promise<void> {
  const { error } = await supabase.rpc("reject_friend_request", { request_id: requestId });
  if (error) {
    throw new Error(`Impossibile rifiutare la richiesta: ${error.message}`);
  }
}
