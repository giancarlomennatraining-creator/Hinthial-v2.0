import { createClient } from "@supabase/supabase-js";

/**
 * Deletes the throwaway Supabase auth users created by the e2e auth flow
 * tests (see auth-shell.spec.ts, emails prefixed "hinthial-e2e-"), so
 * repeated local/CI runs don't leave junk accounts in the configured
 * Supabase project.
 *
 * No-op if SUPABASE_SERVICE_ROLE_KEY isn't configured --- the e2e tests
 * that exercise real auth already can't pass without a configured
 * project, so there is nothing to clean up in that case.
 */
export default async function globalTeardown(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return;

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) break;

    const toDelete = data.users.filter((u) => u.email?.startsWith("hinthial-e2e-"));
    await Promise.all(toDelete.map((u) => admin.auth.admin.deleteUser(u.id)));

    if (data.users.length < perPage) break;
  }
}
