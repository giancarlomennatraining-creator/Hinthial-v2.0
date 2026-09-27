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
