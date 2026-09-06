import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
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

  return { factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret };
}

/** Converte l'SVG grezzo restituito da Supabase in un `src` utilizzabile da un tag `<img>`. */
export function totpQrCodeToImageSrc(qrCodeSvg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCodeSvg)}`;
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

export async function unenrollTotpFactor(
  supabase: SupabaseClient<Database>,
  factorId: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(`Impossibile rimuovere il dispositivo: ${error.message}`);
  }
}
