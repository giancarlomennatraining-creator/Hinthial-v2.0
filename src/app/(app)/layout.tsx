import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/supabase/server";
import { hasMfaVerifiedViaBackupCode } from "@/lib/auth/mfa-bypass";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Shared layout for every authenticated section (dashboard, documents,
 * reminders, assets, contacts, capsules, ai, settings). A route group
 * ((app)) so it applies to all of them without adding a URL segment.
 *
 * This is the single place that guards these routes: it redirects to
 * /login whenever there is no valid Supabase session, and to
 * /login/mfa whenever there is a session but its second factor (v.
 * domain/mfa) hasn't been verified yet --- catches a direct/bookmarked
 * URL reached without going through the /login/mfa step that signIn()
 * (lib/auth/actions.ts) already redirects to right after the password.
 * Un codice di backup non è un vero fattore Supabase, quindi non alza
 * da sé l'AAL della sessione (v. lib/auth/mfa-bypass.ts): il suo
 * cookie conta come equivalente ad aal2 qui, oppure questo gate
 * rimanderebbe sempre indietro anche dopo un codice di backup corretto.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2" && !(await hasMfaVerifiedViaBackupCode())) {
    redirect("/login/mfa");
  }

  return (
    <AppShell
      userId={user.id}
      firstName={user.firstName}
      lastName={user.lastName}
      displayName={user.displayName}
      avatarUrl={user.avatarUrl}
      initialNavOrientation={user.navOrientation}
      initialBottomNavItems={user.bottomNavItems}
      initialOnboardingWidgetHidden={user.onboardingWidgetHidden}
      initialMasterKeyIntroSeen={user.masterKeyIntroSeen}
      initialAIProcessingConsent={user.aiProcessingConsent}
    >
      {children}
    </AppShell>
  );
}
