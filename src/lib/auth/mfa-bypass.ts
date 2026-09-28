import { cookies } from "next/headers";

const COOKIE_NAME = "hinthial-mfa-verified";
// 30 giorni: stessa durata indicativa di una sessione normale, non un'eccezione "una tantum".
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Un codice di backup non è un vero fattore MFA verso Supabase: consumarlo non fa salire l'AAL a aal2 come farebbe
 * un challengeAndVerify reale. Senza questo cookie, il gate su AAL rimanderebbe sempre a /login/mfa anche dopo un
 * codice corretto, un ciclo infinito. HttpOnly: stessa protezione del cookie di sessione.
 */
export async function markMfaVerifiedViaBackupCode(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function hasMfaVerifiedViaBackupCode(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value === "1";
}

/** Va richiamata a ogni nuovo login: senza, un cookie lasciato da una sessione precedente disattiverebbe l'MFA anche per la sessione nuova. Il cookie vale solo per la sessione in cui è stato ottenuto. */
export async function clearMfaVerifiedViaBackupCode(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** L'unico ambiente non-HTTPS di questo progetto è l'e2e (v. playwright.config.ts) --- un cookie Secure non verrebbe mai impostato lì. */
function isSecureContext(): boolean {
  return process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? true;
}
