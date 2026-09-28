import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";

/**
 * Handles the "Confirm signup" email link. The Supabase email template must point here instead of the hosted
 * /auth/v1/verify endpoint ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup): this lets us call
 * verifyOtp() with our own server client, setting the session cookie correctly for SSR (see README.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}/verify-account`);
    }
  }

  return NextResponse.redirect(`${origin}/verify-account?error=1`);
}
