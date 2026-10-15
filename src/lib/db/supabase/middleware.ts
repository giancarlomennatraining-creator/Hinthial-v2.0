import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

/**
 * Refreshes the Supabase auth session (if needed) and keeps the request's
 * cookies in sync with the response, so the session stays valid across
 * Server Component renders. Called from src/middleware.ts on every
 * request that isn't a static asset.
 *
 * This does not redirect for unauthenticated users --- route protection
 * happens per-layout (see src/app/(app)/layout.tsx), which redirects to
 * /login when there is no user.
 */
export async function updateSession(request: NextRequest, extraRequestHeaders: Record<string, string> = {}) {
  // Gli header in più (il nonce e la CSP, v. proxy.ts) devono arrivare al render: si riapplicano a ogni NextResponse.next,
  // anche dopo che il rinnovo della sessione ha cambiato i cookie della richiesta.
  const forward = () => {
    const headers = new Headers(request.headers);
    for (const [key, value] of Object.entries(extraRequestHeaders)) headers.set(key, value);
    return NextResponse.next({ request: { headers } });
  };
  let supabaseResponse = forward();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = forward();
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not add logic between createServerClient and getUser(): calling
  // getUser() is what actually refreshes/validates the session token.
  await supabase.auth.getUser();

  return supabaseResponse;
}
