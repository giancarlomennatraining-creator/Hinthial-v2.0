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
    // Supabase's signUp() rejects reserved placeholder domains like
    // example.com as "invalid" --- mailinator.com is a real, existing
    // domain, so it passes validation (delivery doesn't matter: "Confirm
    // email" is disabled, see README).
    email: `hinthial-e2e-${id}@mailinator.com`,
    password: "password123",
  };
}

/**
 * Creates a confirmed user directly via the Supabase admin API, bypassing
 * signUp() and its confirmation email entirely. Supabase's default
 * (shared) mailer caps email-triggering auth calls at just 2/hour, so
 * only the dedicated registration test should go through the real
 * signUp() flow --- every other test that just needs "a logged-in user"
 * pre-creates one this way and signs in through the real login form.
 */
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

/**
 * Generates a valid recovery OTP for an existing user via the admin API,
 * without actually sending an email --- lets the password-reset e2e tests
 * exercise the real verifyOtp()/updateUser() flow without depending on
 * inbox delivery (same reason signUp() below needs a real address it can
 * reach).
 */
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

/**
 * Deletes any existing auth user with the given email, if one exists.
 * Used to make the real signUp() e2e test repeatable when it must use a
 * fixed, real email address (see E2E_REGISTRATION_TEST_EMAIL in
 * README.md --- a dedicated test address, not anyone's personal one:
 * this wipes and recreates whatever account sits at that address on
 * every run).
 */
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
