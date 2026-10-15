import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase/server";
import { sendEmail } from "@/lib/email/send-email";
import { welcomeEmail } from "@/lib/email/templates";

/**
 * Handles the "Confirm signup" email link. The Supabase email template must point here instead of the hosted
 * /auth/v1/verify endpoint ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup): this lets us call
 * verifyOtp() with our own server client, setting the session cookie correctly for SSR (see README.md).
 *
 * Una registrazione appena confermata riceve l'email di benvenuto. Se l'invio non riesce l'accesso prosegue lo stesso:
 * l'email è un aiuto, non un passaggio obbligato.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const email = data.user?.email;
      if (type === "signup" && email) {
        const firstName = (data.user?.user_metadata?.first_name as string | undefined) ?? null;
        try {
          await sendEmail({ to: email, ...welcomeEmail(firstName) });
        } catch (sendError) {
          console.error("[auth/confirm] email di benvenuto non inviata:", sendError instanceof Error ? sendError.message : sendError);
        }
      }
      return NextResponse.redirect(`${origin}/verify-account`);
    }
  }

  return NextResponse.redirect(`${origin}/verify-account?error=1`);
}
