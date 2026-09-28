import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/supabase/server";
import { hasMfaVerifiedViaBackupCode } from "@/lib/auth/mfa-bypass";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Shared layout for every authenticated section. A route group ((app)) so it applies to all of them without adding
 * a URL segment. This is the single place that guards these routes: redirects to /login without a valid session,
 * and to /login/mfa with a session whose second factor hasn't been verified — catches a direct/bookmarked URL that
 * skipped the /login/mfa step. A backup code doesn't alter the real AAL (v. lib/auth/mfa-bypass.ts): its cookie
 * counts as equivalent to aal2 here, or this gate would redirect back even after a correct backup code.
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
      initialMainNavItems={user.mainNavItems}
      initialOnboardingWidgetHidden={user.onboardingWidgetHidden}
      initialMasterKeyIntroSeen={user.masterKeyIntroSeen}
      initialAIMasterEnabled={user.aiMasterEnabled}
      initialAIChatConsent={user.aiChatConsent}
      initialAIExtractionConsent={user.aiExtractionConsent}
      initialAIHealthConsent={user.aiHealthConsent}
      initialAITranscriptionConsent={user.aiTranscriptionConsent}
      initialAIProactiveAlertsConsent={user.aiProactiveAlertsConsent}
    >
      {children}
    </AppShell>
  );
}
