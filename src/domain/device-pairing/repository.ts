import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * FASE 13, secondo passo --- pairing tra dispositivi via QR code (v.
 * lib/crypto/keypair.ts per la cifratura vera e propria). Questa
 * tabella fa solo da tramite cieco: mai il Master Key in chiaro né una
 * chiave capace di derivarlo da sola.
 */
export interface PairingRequest {
  id: string;
  newDevicePublicKey: string;
  approverPublicKey: string | null;
  encryptedMasterKey: string | null;
  expiresAt: string;
}

function toPairingRequest(row: {
  id: string;
  new_device_public_key: string;
  approver_public_key: string | null;
  encrypted_master_key: string | null;
  expires_at: string;
}): PairingRequest {
  return {
    id: row.id,
    newDevicePublicKey: row.new_device_public_key,
    approverPublicKey: row.approver_public_key,
    encryptedMasterKey: row.encrypted_master_key,
    expiresAt: row.expires_at,
  };
}

/** Lato dispositivo nuovo (es. un PC non ancora fidato): apre una richiesta, mostrata poi come QR code. */
export async function createPairingRequest(
  supabase: SupabaseClient<Database>,
  ownerId: string,
  newDevicePublicKeyJwk: string,
): Promise<PairingRequest> {
  const { data, error } = await supabase
    .from("device_pairing_requests")
    .insert({ owner_id: ownerId, new_device_public_key: newDevicePublicKeyJwk })
    .select("id, new_device_public_key, approver_public_key, encrypted_master_key, expires_at")
    .single();
  if (error) {
    throw new Error(`Impossibile creare la richiesta di accesso: ${error.message}`);
  }
  return toPairingRequest(data);
}

/** Lato dispositivo fidato (lo smartphone, dopo aver scansionato il QR): legge la richiesta per mostrarne i dettagli prima di approvarla. `null` se non trovata o scaduta. */
export async function getPairingRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<PairingRequest | null> {
  const { data, error } = await supabase
    .from("device_pairing_requests")
    .select("id, new_device_public_key, approver_public_key, encrypted_master_key, expires_at")
    .eq("id", requestId)
    .maybeSingle();
  if (error) {
    throw new Error(`Impossibile trovare la richiesta di accesso: ${error.message}`);
  }
  if (!data || new Date(data.expires_at) <= new Date()) return null;
  return toPairingRequest(data);
}

/** Lato dispositivo fidato: approva la richiesta, allegando la propria chiave pubblica effimera e il Master Key già cifrato per il segreto condiviso. */
export async function approvePairingRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
  approverPublicKeyJwk: string,
  encryptedMasterKey: string,
): Promise<void> {
  const { error } = await supabase
    .from("device_pairing_requests")
    .update({ approver_public_key: approverPublicKeyJwk, encrypted_master_key: encryptedMasterKey })
    .eq("id", requestId);
  if (error) {
    throw new Error(`Impossibile approvare la richiesta di accesso: ${error.message}`);
  }
}

/** Lato dispositivo nuovo: un giro di controllo (v. polling nel componente) --- `null` finché non ancora approvata. */
export async function checkPairingRequestApproved(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<{ approverPublicKey: string; encryptedMasterKey: string } | null> {
  const { data, error } = await supabase
    .from("device_pairing_requests")
    .select("approver_public_key, encrypted_master_key")
    .eq("id", requestId)
    .maybeSingle();
  if (error) {
    throw new Error(`Impossibile verificare la richiesta di accesso: ${error.message}`);
  }
  if (!data || !data.approver_public_key || !data.encrypted_master_key) return null;
  return { approverPublicKey: data.approver_public_key, encryptedMasterKey: data.encrypted_master_key };
}

/** Pulizia --- dopo che il dispositivo nuovo ha consumato la risposta, o se la richiesta viene annullata prima di essere approvata. */
export async function deletePairingRequest(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<void> {
  await supabase.from("device_pairing_requests").delete().eq("id", requestId);
}
