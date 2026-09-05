import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Shared layout for every authenticated section (dashboard, documents,
 * reminders, assets, contacts, capsules, ai, settings). A route group
 * ((app)) so it applies to all of them without adding a URL segment.
 *
 * This is the single place that guards these routes: it redirects to
 * /login whenever there is no valid Supabase session.
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
