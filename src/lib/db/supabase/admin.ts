import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Client con la service role key --- bypassa le RLS. Usato SOLO da
 * Server Actions per operazioni che il client anonimo/autenticato non
 * può fare da sé (qui: cancellazione definitiva dell'account via
 * `auth.admin.deleteUser`, v. lib/account/actions.ts). Non deve mai
 * essere importato in codice che gira nel browser:
 * SUPABASE_SERVICE_ROLE_KEY non deve mai lasciare il server.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
