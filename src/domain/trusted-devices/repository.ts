import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/** FASE 13: registro dei dispositivi "fidati" --- sa solo QUALI esistono, mai il Master Key (v. lib/crypto/device-lock.ts). */
export interface TrustedDeviceListItem {
  id: string;
  credentialId: string;
  label: string;
  createdAt: string;
  lastActiveAt: string;
}

/** Solo i dispositivi ancora attivi --- uno revocato equivale già a non esistere più (v. findActiveTrustedDevice). */
export async function listTrustedDevices(
  supabase: SupabaseClient<Database>,
  ownerId: string,
): Promise<TrustedDeviceListItem[]> {
  const { data, error } = await supabase
    .from("trusted_devices")
    .select("id, credential_id, label, created_at, last_active_at")
    .eq("owner_id", ownerId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });
  if (error) {
    throw new Error(`Impossibile caricare i dispositivi fidati: ${error.message}`);
  }
  return data.map((row) => ({
    id: row.id,
    credentialId: row.credential_id,
    label: row.label,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  }));
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

/** Non basta una copia locale del Master Key: potrebbe essere stata revocata da un'altra sessione. `null` se non trovato/revocato. */
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

/** Rimuove la registrazione dal server --- chi chiama deve svuotare anche la copia locale (v. lib/device-lock-storage.ts). */
export async function forgetTrustedDevice(
  supabase: SupabaseClient<Database>,
  deviceId: string,
): Promise<void> {
  const { error } = await supabase.from("trusted_devices").delete().eq("id", deviceId);
  if (error) {
    throw new Error(`Impossibile rimuovere il dispositivo fidato: ${error.message}`);
  }
}
