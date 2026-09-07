import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { generateBackupCodes, hashBackupCode } from "@/domain/mfa/backup-codes";
import type { MfaFactor, TotpEnrollment } from "@/domain/mfa/types";

/**
 * Thin wrapper over Supabase Auth's built-in MFA (TOTP) --- no custom
 * crypto here: the TOTP secret is generated and verified entirely by
 * Supabase's server, the same identity layer that already handles
 * login. Completely separate from the vault's master key/encryption
 * layer (v. HINTHIAL_MVP.md sezione 4): a factor here only gates
 * whether a session can reach `aal2`, it never touches anything cifrato.
 */
export async function enrollTotpFactor(
  supabase: SupabaseClient<Database>,
  friendlyName: string,
): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Hinthial",
    friendlyName,
  });

  if (error) {
    throw new Error(`Impossibile avviare l'attivazione: ${error.message}`);
  }

  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * Il campo `qr_code` restituito da Supabase è già una data URI completa
 * (`data:image/svg+xml;utf-8,<svg...>`), nonostante il commento nei
 * tipi del SDK suggerisca di doverla costruire a mano prependendo
 * quel prefisso --- verificato contro il progetto reale: farlo
 * comunque produce una data URI il cui "contenuto" è essa stessa
 * codificata come URL, non SVG valido (immagine rotta). Qui solo per
 * gestire con grazia un'eventuale versione futura dell'SDK che
 * tornasse a restituire l'SVG grezzo, come descritto nei tipi.
 */
export function totpQrCodeToImageSrc(qrCode: string): string {
  return qrCode.startsWith("data:") ? qrCode : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
}

/**
 * Verifica un codice a 6 cifre per un fattore --- usata sia per
 * confermare un'attivazione appena fatta, sia (altrove, v.
 * lib/auth/actions.ts) per completare il login di chi ha già l'MFA
 * attivo. `challengeAndVerify` crea e verifica la sfida in un solo
 * passaggio: non serve gestire un `challengeId` a parte.
 */
export async function verifyTotpCode(
  supabase: SupabaseClient<Database>,
  factorId: string,
  code: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    throw new Error("Codice non valido. Riprova.");
  }
}

/** Solo i fattori TOTP già verificati --- uno non ancora confermato non conta come "attivo". */
export async function listVerifiedTotpFactors(
  supabase: SupabaseClient<Database>,
): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(`Impossibile caricare i fattori di autenticazione: ${error.message}`);
  }

  return data.totp.map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? "Dispositivo",
    createdAt: factor.created_at,
  }));
}

export async function unenrollFactor(
  supabase: SupabaseClient<Database>,
  factorId: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(`Impossibile rimuovere il dispositivo: ${error.message}`);
  }
}

/**
 * Genera un nuovo set di codici di backup, sostituendo quelli
 * eventuali già esistenti (rigenerare invalida i precedenti --- non
 * possono coesistere due set validi). Restituisce i codici in chiaro,
 * l'unica volta in cui esistono al di fuori di questa funzione: il
 * chiamante li mostra e poi li scarta, mai persistiti da nessuna parte
 * se non come hash (v. domain/mfa/backup-codes.ts).
 */
export async function regenerateBackupCodes(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string[]> {
  const codes = generateBackupCodes();
  const hashes = await Promise.all(codes.map(hashBackupCode));

  const { error: deleteError } = await supabase
    .from("mfa_backup_codes")
    .delete()
    .eq("owner_id", userId);
  if (deleteError) {
    throw new Error(`Impossibile rigenerare i codici di backup: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase
    .from("mfa_backup_codes")
    .insert(hashes.map((code_hash) => ({ owner_id: userId, code_hash })));
  if (insertError) {
    throw new Error(`Impossibile salvare i codici di backup: ${insertError.message}`);
  }

  return codes;
}

export async function countBackupCodes(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("mfa_backup_codes")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if (error) {
    throw new Error(`Impossibile contare i codici di backup: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Verifica un codice di backup e, se valido, lo cancella subito (uso
 * singolo). Usata al login (v. lib/auth/actions.ts) come alternativa a
 * un codice TOTP per chi ha perso l'accesso ai propri dispositivi.
 */
export async function verifyAndConsumeBackupCode(
  supabase: SupabaseClient<Database>,
  userId: string,
  code: string,
): Promise<boolean> {
  const hash = await hashBackupCode(code);

  const { data, error } = await supabase
    .from("mfa_backup_codes")
    .select("id")
    .eq("owner_id", userId)
    .eq("code_hash", hash)
    .maybeSingle();
  if (error || !data) return false;

  const { error: deleteError } = await supabase.from("mfa_backup_codes").delete().eq("id", data.id);
  if (deleteError) return false;

  return true;
}
