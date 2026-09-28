import { createClient } from "@supabase/supabase-js";

export interface TestUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** "{firstName} {lastName}" --- matches the app's own concatenation (see current-user.ts). */
export function fullName(user: TestUser): string {
  return `${user.firstName} ${user.lastName}`;
}

export function uniqueTestUser(): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    // Supabase's signUp() rejects reserved placeholder domains like example.com; mailinator.com is real so it passes validation (delivery doesn't matter, "Confirm email" is disabled).
    email: `hinthial-e2e-${id}@mailinator.com`,
    password: "password123",
  };
}

/** Creates a confirmed user directly via the Supabase admin API, bypassing signUp() and its confirmation email: Supabase's shared mailer caps email-triggering calls at 2/hour, so only the dedicated registration test uses real signUp(). */
export async function createConfirmedTestUser(user: TestUser): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono richieste per pre-creare utenti di test.",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { first_name: user.firstName, last_name: user.lastName },
  });

  if (error) {
    throw new Error(`Impossibile pre-creare l'utente di test: ${error.message}`);
  }
}

/**
 * Forza `is_friend`/`is_guardian` via il client admin, bypassando la vera doppia richiesta di consenso: SOLO per i
 * test che hanno bisogno di "un amico guardiano" come dato di partenza per verificare qualcos'altro, non per chi
 * verifica il flusso di consenso in sé (v. friends.spec.ts). Paginata: con centinaia di utenti di test accumulati
 * nel progetto dev, un `perPage` singolo potrebbe non bastare.
 */
export async function forceOwnFriendToGuardian(ownerEmail: string): Promise<void> {
  const admin = adminClient();

  const perPage = 200;
  let ownerId: string | null = null;
  for (let page = 1; !ownerId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) throw new Error(`Impossibile trovare l'utente: ${error?.message}`);
    ownerId = data.users.find((u) => u.email === ownerEmail)?.id ?? null;
    if (!ownerId && data.users.length < perPage) {
      throw new Error(`Nessun account con email ${ownerEmail}.`);
    }
  }

  const { error } = await admin
    .from("friends")
    .update({ is_friend: true, is_guardian: true })
    .eq("owner_id", ownerId);
  if (error) {
    throw new Error(`Impossibile forzare l'amico a guardiano: ${error.message}`);
  }
}

/**
 * Riporta i documenti di un account allo stato "mai letto": serve a provare il recupero dal banner in Archivio
 * senza avere un archivio storico vero. Il testo cifrato viene rimosso, non riscritto: questa funzione non ha la
 * Master Key. Azzera anche `has_thumbnail`: entrambe si recuperano dallo stesso "Leggili ora"/"Rileggi". Il file
 * cifrato della miniatura in Storage non viene rimosso: `has_thumbnail: false` basta a far ricadere sul file intero.
 */
export async function resetDocumentExtraction(ownerEmail: string): Promise<void> {
  const admin = adminClient();

  const perPage = 200;
  let ownerId: string | null = null;
  for (let page = 1; !ownerId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) throw new Error(`Impossibile trovare l'utente: ${error?.message}`);
    ownerId = data.users.find((u) => u.email === ownerEmail)?.id ?? null;
    if (!ownerId && data.users.length < perPage) {
      throw new Error(`Nessun account con email ${ownerEmail}.`);
    }
  }

  const { error } = await admin
    .from("documents")
    .update({ extracted_at: null, encrypted_extracted_text: null, has_thumbnail: false })
    .eq("owner_id", ownerId);
  if (error) {
    throw new Error(`Impossibile azzerare l'estrazione: ${error.message}`);
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono richieste.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Generates a valid recovery OTP via the admin API without sending an email: lets the password-reset e2e tests exercise the real verifyOtp()/updateUser() flow without depending on inbox delivery. */
export async function generateRecoveryOtp(email: string): Promise<string> {
  const admin = adminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error || !data.properties?.email_otp) {
    throw new Error(`Impossibile generare un codice di recupero: ${error?.message}`);
  }

  return data.properties.email_otp;
}

/** Deletes any existing auth user with the given email. Makes the real signUp() e2e test repeatable when it uses a fixed address (see E2E_REGISTRATION_TEST_EMAIL in README.md, a dedicated test address, not anyone's personal one). */
export async function deleteUserByEmail(email: string): Promise<void> {
  const admin = adminClient();

  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return;

    const match = data.users.find((u) => u.email === email);
    if (match) {
      await admin.auth.admin.deleteUser(match.id);
      return;
    }

    if (data.users.length < perPage) return;
  }
}
