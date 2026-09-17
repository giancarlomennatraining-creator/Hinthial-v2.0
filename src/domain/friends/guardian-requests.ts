import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logAuditEvent } from "@/lib/audit/log-event";

/**
 * Richiesta di diventare guardiano, in arrivo --- v. migrazione
 * guardian_role_requests. Distinta da guardian_verification_requests
 * (domain/digital-legacy/guardians.ts): questa è il consenso
 * PRELIMINARE per assumere il ruolo, non la verifica reale di
 * un'inattività, che arriva solo più avanti e solo se il ruolo è già
 * stato accettato.
 */
export interface IncomingGuardianRoleRequest {
  id: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

/** Un rapporto guardiano/protetto già accettato, dal punto di vista del guardiano. */
export interface ProtectedRelationship {
  requestId: string;
  ownerId: string;
  ownerName: string;
  acceptedAt: string | null;
}

async function namesByOwnerId(
  supabase: SupabaseClient<Database>,
  ownerIds: string[],
): Promise<Map<string, string>> {
  if (ownerIds.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ownerIds);
  if (error) {
    throw new Error(`Impossibile caricare i nomi dei proprietari: ${error.message}`);
  }
  return new Map((data ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));
}

/** Richieste di diventare guardiano ancora in sospeso per l'utente corrente. */
export async function listIncomingGuardianRoleRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<IncomingGuardianRoleRequest[]> {
  const { data, error } = await supabase
    .from("guardian_role_requests")
    .select("id, owner_id, created_at")
    .eq("guardian_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare le richieste di guardiano: ${error.message}`);
  }
  if (!data || data.length === 0) return [];

  const nameById = await namesByOwnerId(supabase, data.map((row) => row.owner_id));

  return data.map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: nameById.get(row.owner_id) ?? "Un utente Hinthial",
    createdAt: row.created_at,
  }));
}

/** Le persone che l'utente corrente protegge già, come guardiano accettato. */
export async function listMyProtected(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ProtectedRelationship[]> {
  const { data, error } = await supabase
    .from("guardian_role_requests")
    .select("id, owner_id, responded_at")
    .eq("guardian_user_id", userId)
    .eq("status", "accepted")
    .order("responded_at", { ascending: false });

  if (error) {
    throw new Error(`Impossibile caricare i tuoi protetti: ${error.message}`);
  }
  if (!data || data.length === 0) return [];

  const nameById = await namesByOwnerId(supabase, data.map((row) => row.owner_id));

  return data.map((row) => ({
    requestId: row.id,
    ownerId: row.owner_id,
    ownerName: nameById.get(row.owner_id) ?? "Un utente Hinthial",
    acceptedAt: row.responded_at,
  }));
}

/** Le richieste di diventare guardiano che il proprietario ha già mandato e sono ancora in sospeso --- per mostrare "in attesa" invece del tasto sulla riga dell'amico. */
export async function listOutgoingPendingGuardianRoleRequests(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("guardian_role_requests")
    .select("guardian_user_id")
    .eq("owner_id", userId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Impossibile caricare le richieste di guardiano inviate: ${error.message}`);
  }
  return (data ?? []).map((row) => row.guardian_user_id);
}

/**
 * Chiede a un AMICO di diventare guardiano --- solo un AMICO può
 * diventarlo (v. policy guardian_role_requests_insert_owner, che
 * verifica `is_friend = true` lato database). Mai un flag impostato
 * direttamente: da qui in poi serve sempre l'accettazione esplicita di
 * chi lo riceve (v. richiesta utente).
 */
export async function requestGuardianRole(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  friendId: string,
  guardianUserId: string,
): Promise<void> {
  const { error } = await supabase.from("guardian_role_requests").insert({
    owner_id: ownerId,
    guardian_user_id: guardianUserId,
    friend_id: friendId,
  });

  if (error) {
    throw new Error(`Impossibile inviare la richiesta di guardiano: ${error.message}`);
  }

  await logAuditEvent(supabase, ownerId, "guardian_role_requested");
}

export async function acceptGuardianRoleRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<void> {
  const { error } = await supabase.rpc("accept_guardian_role_request", { request_id: requestId });
  if (error) {
    throw new Error(`Impossibile accettare la richiesta: ${error.message}`);
  }
}

export async function rejectGuardianRoleRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<void> {
  const { error } = await supabase.rpc("reject_guardian_role_request", { request_id: requestId });
  if (error) {
    throw new Error(`Impossibile rifiutare la richiesta: ${error.message}`);
  }
}

/** Il PROPRIETARIO rimuove un guardiano già accettato --- nessun consenso richiesto per togliere la responsabilità, solo per darla (v. requestGuardianRole). */
export async function revokeGuardianRole(supabase: SupabaseClient<Database>, friendId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_guardian_role", { p_friend_id: friendId });
  if (error) {
    throw new Error(`Impossibile rimuovere il guardiano: ${error.message}`);
  }
}

/** Il GUARDIANO si dimette da solo --- v. richiesta utente: visibilità reciproca (PROTETTO) significa anche potersi tirare indietro. */
export async function resignAsGuardian(supabase: SupabaseClient<Database>, requestId: string): Promise<void> {
  const { error } = await supabase.rpc("resign_as_guardian", { request_id: requestId });
  if (error) {
    throw new Error(`Impossibile dimettersi da guardiano: ${error.message}`);
  }
}
