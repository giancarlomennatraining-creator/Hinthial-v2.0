"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { logAuditEvent } from "@/lib/audit/log-event";
import type { AuthActionState } from "@/lib/auth/action-state";

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Email o password non corretti.";
  }
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Esiste già un account con questa email.";
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
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!displayName || !email || !password) {
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
    options: { data: { display_name: displayName } },
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
    redirect(`/controlla-email?email=${encodeURIComponent(email)}`);
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

  await logAuditEvent(supabase, data.user.id, "login");

  redirect("/dashboard");
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

  redirect("/");
}
