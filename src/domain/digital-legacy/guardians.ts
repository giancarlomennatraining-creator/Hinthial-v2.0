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

/**
 * Legge una richiesta di verifica per il guardiano che la sta guardando
 * (v. app/(app)/guardian-check/[requestId]) --- RLS (v. migrazione
 * guardian_verification_requests) garantisce già che solo il guardiano
 * interpellato possa leggere QUESTA riga; il nome del proprietario è
 * una query separata (v. migrazione guardian_profile_visibility: stesso
 * schema di "Condivise con me"), mai un join lato server su dati cifrati.
 */
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

/**
 * Registra la risposta del guardiano --- passa da una funzione
 * Postgres SECURITY DEFINER (v. migrazione guardian_response_audit)
 * invece di un update diretto: serve anche a registrare l'evento nel
 * registro Attività DEL PROPRIETARIO (owner_id diverso da auth.uid(),
 * impossibile con un insert diretto sotto RLS). La funzione ripete a
 * mano lo stesso controllo che l'RLS farebbe (guardian_user_id =
 * auth.uid()): se la riga non è la propria, non succede nulla, senza
 * errore.
 */
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
