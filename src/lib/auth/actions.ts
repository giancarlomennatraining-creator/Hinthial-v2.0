"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { logAuditEvent, logFailedLoginAttempt } from "@/lib/audit/log-event";
import { getRequestContext } from "@/lib/http/request-context";
import { verifyAndConsumeBackupCode } from "@/domain/mfa/repository";
import { clearMfaVerifiedViaBackupCode, markMfaVerifiedViaBackupCode } from "@/lib/auth/mfa-bypass";
import type { AuthActionState } from "@/lib/auth/action-state";

// Il benvenuto (v. LoginSplash) dura ~3,5 s e copre la pagina: i test e2e, che fanno decine di login, lo spengono con DISABLE_LOGIN_SPLASH=1 (v. playwright.config.ts).
function dashboardAfterLogin(): string {
  return process.env.DISABLE_LOGIN_SPLASH === "1" ? "/dashboard" : "/dashboard?justLoggedIn=1";
}

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o password non corretti.";
  }
  if (normalized.includes("email not confirmed") || normalized.includes("email_not_confirmed")) {
    return "Devi prima confermare la tua email: controlla la posta (anche lo spam) e apri il link ricevuto alla registrazione.";
  }
  if (normalized.includes("error sending confirmation") || normalized.includes("error sending recovery")) {
    return "Non è stato possibile inviare l'email. Riprova tra qualche minuto o contatta l'assistenza.";
  }
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Esiste già un account con questa email.";
  }
  if (normalized.includes("token") && (normalized.includes("expired") || normalized.includes("invalid"))) {
    return "Codice non valido o scaduto. Richiedine uno nuovo.";
  }
  if (normalized.includes("different from the old password") || normalized.includes("same_password")) {
    return "La nuova password deve essere diversa da quella attuale.";
  }
  if (normalized.includes("weak") || normalized.includes("pwned") || normalized.includes("easy to guess")) {
    return "Questa password è troppo debole o compare in elenchi di password rubate: scegline un'altra.";
  }
  if (normalized.includes("at least") || normalized.includes("characters")) {
    return "La password non rispetta i requisiti minimi (almeno 6 caratteri).";
  }
  if (normalized.includes("password")) {
    return "La password non è stata accettata: scegline un'altra.";
  }
  if (normalized.includes("rate limit")) {
    return "Troppi tentativi. Riprova tra qualche minuto.";
  }
  return "Si è verificato un errore. Riprova.";
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!firstName || !lastName || !email || !password) {
    return { error: "Compila tutti i campi." };
  }
  if (password.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri." };
  }
  if (password !== confirmPassword) {
    return { error: "Le password non coincidono." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName, birth_date: birthDate || null } },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }
  if (!data.user) {
    return { error: "Si è verificato un errore. Riprova." };
  }

  if (!data.session) {
    // Conferma email attiva: niente sessione ancora, si manda a una pagina dedicata invece di rimbalzare su /login.
    redirect(`/check-email?email=${encodeURIComponent(email)}`);
  }

  // Conferma email disattivata: signUp ha già restituito una sessione attiva, trattato come primo login implicito.
  const signUpContext = await getRequestContext();
  await logAuditEvent(supabase, data.user.id, "login", { method: "password", ...signUpContext });

  redirect(dashboardAfterLogin());
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password.", email };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Nessuna sessione ancora: RLS richiede auth.uid() = owner_id, quindi passa da una funzione dedicata.
    await logFailedLoginAttempt(supabase, email);
    return { error: translateAuthError(error.message), email };
  }

  // Un cookie di una sessione precedente non deve valere per questa: altrimenti un solo codice di backup disattiverebbe l'MFA per sempre su questo browser.
  await clearMfaVerifiedViaBackupCode();

  // Chi ha l'MFA attiva non è ancora "dentro": la sessione è solo aal1, serve il secondo fattore prima di registrare il login (v. /login/mfa).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/login/mfa");
  }

  const signInContext = await getRequestContext();
  await logAuditEvent(supabase, data.user.id, "login", { method: "password", ...signInContext });

  redirect(dashboardAfterLogin());
}

export async function verifyMfaCode(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    return { error: "Inserisci il codice a 6 cifre." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sessione scaduta. Accedi di nuovo." };
  }

  const mfaContext = await getRequestContext();

  // Un codice di backup ha un formato ben distinto da un codice TOTP: un controllo veloce prima di provare gli altri fattori.
  if (await verifyAndConsumeBackupCode(supabase, user.id, code)) {
    await markMfaVerifiedViaBackupCode();
    await logAuditEvent(supabase, user.id, "login", { method: "backup_code", ...mfaContext });
    redirect(dashboardAfterLogin());
  }

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || factorsData.totp.length === 0) {
    await logAuditEvent(supabase, user.id, "mfa_challenge_failed");
    return { error: "Codice non valido. Riprova." };
  }

  // Un codice non dichiara per quale dispositivo è stato generato: si prova su ognuno dei fattori finché uno accetta.
  for (const factor of factorsData.totp) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (!error) {
      await logAuditEvent(supabase, user.id, "login", { method: "totp", ...mfaContext });
      redirect(dashboardAfterLogin());
    }
  }

  await logAuditEvent(supabase, user.id, "mfa_challenge_failed");
  return { error: "Codice non valido. Riprova." };
}

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Inserisci la tua email." };
  }

  const supabase = await createClient();

  // Si ignora deliberatamente un eventuale errore e si prosegue comunque, per non rivelare quali email sono registrate.
  await supabase.auth.resetPasswordForEmail(email);

  redirect(`/forgot-password/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyPasswordResetOtp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const otp = String(formData.get("otp") ?? "").trim();

  if (!email || !otp) {
    return { error: "Inserisci il codice ricevuto via email." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "recovery",
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect("/forgot-password/new");
}

export async function resetPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) {
    return { error: "Inserisci una nuova password." };
  }
  if (password.length < 8) {
    return { error: "La password deve avere almeno 8 caratteri." };
  }
  if (password !== confirmPassword) {
    return { error: "Le password non coincidono." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Nessuna sessione di recupero attiva (es. pagina raggiunta direttamente, senza aver verificato un OTP prima).
    return { error: "Sessione di recupero scaduta. Ricomincia la procedura." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // Non lasciare attiva la sessione di recupero: l'utente rientra con le nuove credenziali dal login.
  await supabase.auth.signOut();

  redirect("/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Loggato mentre la sessione è ancora valida: signOut() sotto la invalida, e RLS richiede auth.uid() = owner_id.
    await logAuditEvent(supabase, user.id, "logout");
  }

  await supabase.auth.signOut();
  // Ridondante con la stessa pulizia in signIn(), ma corretto anche qui per lo stesso motivo.
  await clearMfaVerifiedViaBackupCode();

  redirect("/");
}
