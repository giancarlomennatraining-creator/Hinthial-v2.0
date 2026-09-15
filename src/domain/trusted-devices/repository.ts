import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * FASE 13 --- registro dei dispositivi "fidati" (v.
 * lib/crypto/device-lock.ts per la cifratura vera e propria, mai
 * toccata qui): questa tabella sa solo QUALI dispositivi esistono,
 * mai il Master Key né alcun segreto che permetta di derivarlo.
 */
export interface TrustedDeviceListItem {
  id: string;
  credentialId: string;
  label: string;
  createdAt: string;
  lastActiveAt: string;
}

export async function registerTrustedDevice(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  credentialId: string,
  label: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("trusted_devices")
    .insert({ owner_id: ownerId, credential_id: credentialId, label })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Impossibile registrare il dispositivo fidato: ${error.message}`);
  }
  return { id: data.id };
}

/**
 * Verifica che questo dispositivo (identificato dalla sua credenziale
 * WebAuthn) sia ancora un dispositivo fidato valido per l'account ---
 * non basta che esista una copia locale del Master Key: potrebbe
 * essere stata revocata da un'altra sessione nel frattempo (v. fasi
 * successive per la revoca vera e propria). `null` se non trovato o
 * revocato.
 */
export async function findActiveTrustedDevice(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  credentialId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("credential_id", credentialId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(`Impossibile verificare il dispositivo fidato: ${error.message}`);
  }
  return data ? { id: data.id } : null;
}

/** Aggiornato a ogni sblocco riuscito da questo dispositivo --- solo per l'elenco (v. fasi successive), nessun ruolo di sicurezza. */
export async function touchTrustedDeviceLastActive(
  supabase: SupabaseClient<Database>,
  deviceId: string,
): Promise<void> {
  await supabase.from("trusted_devices").update({ last_active_at: new Date().toISOString() }).eq("id", deviceId);
}

/**
 * "Dimentica questo dispositivo" --- rimuove la registrazione dal
 * server. Chi chiama è responsabile di svuotare anche la copia locale
 * (v. lib/device-lock-storage.ts): questa funzione da sola non la
 * tocca, non può farlo (vive nel browser, non sul server).
 */
export async function forgetTrustedDevice(
  supabase: SupabaseClient<Database>,
  deviceId: string,
): Promise<void> {
  const { error } = await supabase.from("trusted_devices").delete().eq("id", deviceId);
  if (error) {
    throw new Error(`Impossibile rimuovere il dispositivo fidato: ${error.message}`);
  }
}
