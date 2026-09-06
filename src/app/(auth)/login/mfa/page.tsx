import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/supabase/server";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";

/**
 * Passo successivo al login per chi ha l'autenticazione a due fattori
 * attiva --- v. lib/auth/actions.ts (signIn/verifyMfaCode). Raggiunta
 * solo con una sessione aal1 che può salire ad aal2: chi non ha
 * un'autenticazione in sospeso qui non ha nulla da fare, si manda
 * altrove piuttosto che mostrare un modulo inutile.
 */
export default async function LoginMfaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.currentLevel === "aal2" || aal.nextLevel !== "aal2") {
    redirect("/dashboard");
  }

  return <MfaChallengeForm />;
}
