import { createClient } from "@/lib/db/supabase/server";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

/**
 * Ultimo passo del recupero password. Chi ha l'autenticazione a due fattori deve provarla anche qui (v. resetPassword
 * in lib/auth/actions.ts): lo si legge dalla sessione di recupero, che a questo punto è solo aal1.
 */
export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let requiresMfa = false;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    requiresMfa = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  return <NewPasswordForm requiresMfa={requiresMfa} />;
}
