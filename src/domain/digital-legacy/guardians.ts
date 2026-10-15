import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** Le tre risposte possibili a "riesci a raggiungere [nome]?" --- v. GuardianVerificationPanel.tsx. */
export type GuardianVerificationResponse = "ok" | "unknown" | "unreachable";

export interface GuardianVerificationRequestView {
  id: string;
  ownerName: string;
  response: GuardianVerificationResponse | null;
  createdAt: string;
}

/** RLS garantisce che solo il guardiano interpellato legga questa riga; il nome proprietario è una query separata, mai un join. */
export async function getGuardianVerificationRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<GuardianVerificationRequestView | null> {
  const { data: request, error } = await supabase
    .from("guardian_verification_requests")
    .select("id, owner_id, response, created_at")
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossibile leggere la richiesta: ${error.message}`);
  }
  if (!request) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", request.owner_id)
    .maybeSingle();
  if (profileError) {
    throw new Error(`Impossibile leggere il nome del proprietario: ${profileError.message}`);
  }

  return {
    id: request.id,
    ownerName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "questo account",
    response: request.response,
    createdAt: request.created_at,
  };
}

/** RPC SECURITY DEFINER, non un update diretto: serve anche a loggare in Attività DEL PROPRIETARIO, impossibile sotto RLS diretta. */
export async function respondToGuardianVerificationRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  response: GuardianVerificationResponse,
): Promise<void> {
  const { error } = await supabase.rpc("respond_to_guardian_verification_request", {
    request_id: requestId,
    response_value: response,
  });

  if (error) {
    throw new Error(`Impossibile registrare la risposta: ${error.message}`);
  }
}

export interface PendingGuardianCheck {
  id: string;
  ownerName: string;
  createdAt: string;
}

/**
 * Le richieste "hai notizie di …?" ancora senza risposta per chi è guardiano: compaiono anche dentro l'app (Oggi, Protetti),
 * non solo nell'email, così una richiesta finita nello spam non si perde. RLS mostra solo le righe in cui sei il guardiano;
 * i nomi con una sola lettura (v. profiles_select_by_guardian), mai una per persona.
 */
export async function listPendingGuardianChecks(
  supabase: SupabaseClient<Database>,
  guardianUserId: string,
): Promise<PendingGuardianCheck[]> {
  const { data: requests, error } = await supabase
    .from("guardian_verification_requests")
    .select("id, owner_id, created_at")
    .eq("guardian_user_id", guardianUserId)
    .is("response", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Impossibile leggere le richieste: ${error.message}`);
  }
  if (!requests || requests.length === 0) return [];

  const ownerIds = [...new Set(requests.map((r) => r.owner_id))];
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", ownerIds);
  if (profileError) {
    throw new Error(`Impossibile leggere i nomi: ${profileError.message}`);
  }
  const names = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]));

  return requests.map((r) => ({
    id: r.id,
    ownerName: names.get(r.owner_id) || "una persona che ti ha scelto",
    createdAt: r.created_at,
  }));
}
