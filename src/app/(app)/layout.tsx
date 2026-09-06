import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/db/supabase/server";
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
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
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
    >
      {children}
    </AppShell>
  );
}
