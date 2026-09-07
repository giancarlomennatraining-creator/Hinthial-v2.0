"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import { verifyAndConsumeBackupCode } from "@/domain/mfa/repository";
import { clearMfaVerifiedViaBackupCode, markMfaVerifiedViaBackupCode } from "@/lib/auth/mfa-bypass";
import type { AuthActionState } from "@/lib/auth/action-state";

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
  if (normalized.includes("password")) {
    return "La password non rispetta i requisiti minimi (almeno 6 caratteri).";
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
    options: { data: { first_name: firstName, last_name: lastName } },
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }
  if (!data.user) {
    return { error: "Si è verificato un errore. Riprova." };
  }

  if (!data.session) {
    // Email confirmation is enabled on this project: there is no active
    // session yet, so redirecting to the dashboard would just bounce
    // straight back to /login. Send the user to a dedicated page
    // instead of showing an inline message on the register form.
    redirect(`/check-email?email=${encodeURIComponent(email)}`);
  }

  // Email confirmation disabled --- signUp already returned an active
  // session: treat it as an implicit first login.
  await logAuditEvent(supabase, data.user.id, "login");

  redirect("/dashboard");
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Inserisci email e password." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // Un cookie di una sessione precedente (v. lib/auth/mfa-bypass.ts) non
  // deve valere per questa, appena creata e ancora aal1: altrimenti un
  // solo codice di backup usato una volta disattiverebbe l'MFA per
  // sempre su questo browser, non solo per quella sessione.
  await clearMfaVerifiedViaBackupCode();

  // Chi ha l'autenticazione a due fattori attiva non è ancora "dentro"
  // per davvero: la sessione è solo aal1 (password verificata), serve
  // ancora il codice del secondo fattore prima di registrare il login
  // e concedere l'accesso (v. (app)/layout.tsx per la stessa verifica
  // sulle richieste dirette, e /login/mfa per dove si completa).
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/login/mfa");
  }

  await logAuditEvent(supabase, data.user.id, "login");

  redirect("/dashboard");
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

  // Un codice di backup ha un formato ben distinto da un codice TOTP a 6
  // cifre (v. domain/mfa/backup-codes.ts): un controllo veloce prima di
  // provare gli altri fattori, non un'alternativa esplicita da scegliere.
  // Un codice di backup ha un formato ben distinto da un codice TOTP a 6
  // cifre (v. domain/mfa/backup-codes.ts): un controllo veloce prima di
  // provare gli altri fattori, non un'alternativa esplicita da scegliere.
  if (await verifyAndConsumeBackupCode(supabase, user.id, code)) {
    await markMfaVerifiedViaBackupCode();
    await logAuditEvent(supabase, user.id, "login");
    redirect("/dashboard");
  }

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError || factorsData.totp.length === 0) {
    return { error: "Codice non valido. Riprova." };
  }

  // Un codice non dichiara per quale dispositivo è stato generato: si
  // prova su ognuno dei fattori verificati finché uno accetta ---
  // realisticamente uno o due, mai un elenco lungo.
  for (const factor of factorsData.totp) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (!error) {
      await logAuditEvent(supabase, user.id, "login");
      redirect("/dashboard");
    }
  }

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

  // Supabase non rivela se l'indirizzo corrisponde a un account esistente:
  // si ignora deliberatamente un eventuale errore e si prosegue comunque
  // al passo successivo, per non permettere di scoprire quali email sono
  // registrate.
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
    // Nessuna sessione di recupero attiva (es. pagina raggiunta
    // direttamente, senza aver verificato un codice OTP prima).
    return { error: "Sessione di recupero scaduta. Ricomincia la procedura." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: translateAuthError(error.message) };
  }

  // Non lasciare attiva la sessione di recupero: l'utente rientra con le
  // nuove credenziali dal login, come dopo una registrazione.
  await supabase.auth.signOut();

  redirect("/login");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Logged while the session is still valid --- signOut() below
    // invalidates it, and RLS requires auth.uid() = owner_id to insert.
    await logAuditEvent(supabase, user.id, "logout");
  }

  await supabase.auth.signOut();
  // Ridondante con la stessa pulizia in signIn() --- ma corretto anche
  // qui, per lo stesso motivo (v. lib/auth/mfa-bypass.ts).
  await clearMfaVerifiedViaBackupCode();

  redirect("/");
}
