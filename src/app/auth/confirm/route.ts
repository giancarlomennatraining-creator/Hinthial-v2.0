import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";

/**
 * Handles the "Confirm signup" email link.
 *
 * The Supabase project's email template must be customized (Dashboard
 * --- Authentication --- Emails --- Templates --- "Confirm signup") to
 * point here instead of Supabase's own hosted /auth/v1/verify endpoint:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 *
 * This lets us call verifyOtp() with our own server client
 * (src/lib/db/supabase/server.ts), which sets the session cookie
 * correctly for this SSR setup --- the default Supabase-hosted link
 * redirects with tokens in the URL fragment instead, which doesn't work
 * the same way with server-rendered cookie sessions. See README.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}/verifica-account`);
    }
  }

  return NextResponse.redirect(`${origin}/verifica-account?errore=1`);
}
