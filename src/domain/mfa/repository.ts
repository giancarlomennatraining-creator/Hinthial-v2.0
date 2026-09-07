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

/** Funziona per qualunque tipo di fattore (TOTP o passkey): `unenroll` non distingue. */
export async function unenrollFactor(
  supabase: SupabaseClient<Database>,
  factorId: string,
): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    throw new Error(`Impossibile rimuovere il dispositivo: ${error.message}`);
  }
}

function friendlyWebauthnError(message: string): string {
  if (message === "mfa_webauthn_enroll_not_enabled" || message.includes("disabled for WebAuthn")) {
    return "Le passkey non sono ancora attive su questo progetto Supabase (Authentication > MFA nel dashboard).";
  }
  return message === "The operation either timed out or was not allowed."
    ? "Operazione annullata o scaduta. Riprova."
    : `Impossibile completare l'operazione: ${message}`;
}

/**
 * Registra una passkey (WebAuthn --- impronta, Face ID, Windows Hello o
 * una chiave fisica) come secondo fattore. Non esiste un metodo
 * "register" a scorciatoia completa nell'SDK per questo (a differenza
 * del TOTP, dove `enroll`+conferma bastano): qui si orchestrano a mano
 * i tre passaggi standard dell'MFA (enroll -> challenge -> verify),
 * intervallati dalla cerimonia del browser (`navigator.credentials.create`).
 * `mfa.challenge()` restituisce le opzioni già pronte per il browser
 * (converte da sé il formato del server), e `mfa.verify()` serializza
 * da sé la credenziale del browser per il server --- nessuna
 * conversione manuale necessaria da parte nostra.
 *
 * Nota: è un fattore per il *login*, una credenziale WebAuthn separata
 * da quella eventualmente usata in futuro (FASE 13, HINTHIAL_MVP.md)
 * per sbloccare la master key su un dispositivo fidato --- stessa
 * tecnologia del browser, due scopi e due registrazioni distinte, mai
 * la stessa credenziale per entrambi.
 */
export async function registerWebauthnFactor(
  supabase: SupabaseClient<Database>,
  friendlyName: string,
): Promise<void> {
  const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "webauthn",
    friendlyName,
  });
  if (enrollError || !enrolled) {
    throw new Error(friendlyWebauthnError(enrollError?.message ?? "Risposta inattesa dal server."));
  }
  // Estratto in una variabile propria (non `enrolled.id` nella closure
  // sotto): TypeScript non propaga il narrowing di `enrolled` dentro
  // una funzione annidata che lo cattura.
  const factorId = enrolled.id;

  async function cleanupUnverifiedFactor() {
    await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
  }

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
    webauthn: { rpId: window.location.hostname },
  });
  if (challengeError || challenge.webauthn.type !== "create") {
    await cleanupUnverifiedFactor();
    throw new Error(friendlyWebauthnError(challengeError?.message ?? "Risposta inattesa dal server."));
  }

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({
      // Le opzioni dell'SDK ("Future") anticipano campi WebAuthn più
      // recenti (es. il transport "cable") dei tipi DOM di TypeScript
      // --- compatibili col browser reale, non con la libreria di tipi.
      publicKey: challenge.webauthn.credential_options.publicKey as unknown as PublicKeyCredentialCreationOptions,
    });
  } catch (err) {
    await cleanupUnverifiedFactor();
    throw new Error(
      err instanceof DOMException && err.name === "NotAllowedError"
        ? "Operazione annullata o scaduta. Riprova."
        : "Impossibile creare la passkey su questo dispositivo/browser.",
    );
  }
  if (!credential) {
    await cleanupUnverifiedFactor();
    throw new Error("Impossibile creare la passkey su questo dispositivo/browser.");
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    webauthn: {
      rpId: window.location.hostname,
      type: "create",
      // navigator.credentials.create({publicKey}) restituisce sempre un
      // PublicKeyCredential in questo ramo; verify() lo serializza da sé.
      credential_response: credential as never,
    },
  });
  if (verifyError) {
    await cleanupUnverifiedFactor();
    throw new Error(friendlyWebauthnError(verifyError.message));
  }
}

/** Solo le passkey già verificate --- stessa idea di listVerifiedTotpFactors, per l'altro tipo di fattore. */
export async function listVerifiedWebauthnFactors(
  supabase: SupabaseClient<Database>,
): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(`Impossibile caricare i fattori di autenticazione: ${error.message}`);
  }

  return data.webauthn.map((factor) => ({
    id: factor.id,
    friendlyName: factor.friendly_name ?? "Passkey",
    createdAt: factor.created_at,
  }));
}

/**
 * Login con una passkey già registrata --- stessa orchestrazione
 * manuale di registerWebauthnFactor, ma per l'autenticazione (challenge
 * di tipo "request", `navigator.credentials.get` invece di `.create`).
 * Solo lato client: richiede `navigator.credentials`, non disponibile
 * in un server action (v. WebauthnLoginButton.tsx).
 */
export async function authenticateWithWebauthnFactor(
  supabase: SupabaseClient<Database>,
  factorId: string,
): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
    webauthn: { rpId: window.location.hostname },
  });
  if (challengeError || challenge.webauthn.type !== "request") {
    throw new Error(friendlyWebauthnError(challengeError?.message ?? "Risposta inattesa dal server."));
  }

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({
      publicKey: challenge.webauthn.credential_options.publicKey as unknown as PublicKeyCredentialRequestOptions,
    });
  } catch (err) {
    throw new Error(
      err instanceof DOMException && err.name === "NotAllowedError"
        ? "Operazione annullata o scaduta. Riprova."
        : "Impossibile verificare la passkey su questo dispositivo/browser.",
    );
  }
  if (!credential) {
    throw new Error("Impossibile verificare la passkey su questo dispositivo/browser.");
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    webauthn: {
      rpId: window.location.hostname,
      type: "request",
      credential_response: credential as never,
    },
  });
  if (verifyError) {
    throw new Error(friendlyWebauthnError(verifyError.message));
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
