import { createClient } from "@supabase/supabase-js";

export interface TestUser {
  displayName: string;
  email: string;
  password: string;
}

export function uniqueTestUser(): TestUser {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    displayName: "Ada Lovelace",
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
    user_metadata: { display_name: user.displayName },
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
 * Deletes any existing auth user with the given email, if one exists.
 * Used to make the real signUp() e2e test repeatable when it must use a
 * fixed, real email address (see E2E_REGISTRATION_TEST_EMAIL in
 * README.md --- Resend's unverified sender can only deliver to the
 * Supabase project owner's own address).
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
