import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

/**
 * Supabase client for use in Server Components, Server Actions and Route
 * Handlers --- bound to the current request's cookies so the user's
 * session is available server-side.
 *
 * Server Components can only *read* cookies, so `setAll` may fail there;
 * that's fine as long as `middleware.ts` is refreshing the session on
 * every request (see src/lib/db/supabase/middleware.ts).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render --- ignored because
            // middleware.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}
