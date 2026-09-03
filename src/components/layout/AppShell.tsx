import { Sidebar } from "@/components/layout/Sidebar";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";
import { ListViewPreferencesProvider } from "@/components/layout/ListViewPreferencesProvider";
import { AIChatProvider } from "@/components/ai/AIChatProvider";

/**
 * Shared chrome for the authenticated app (sidebar nav + user menu).
 *
 * Purely presentational --- the caller (src/app/(app)/layout.tsx) is
 * responsible for checking that a user is signed in before rendering
 * this, since that's where the real Supabase session check happens.
 */
export function AppShell({
  userId,
  firstName,
  lastName,
  displayName,
  avatarUrl,
  children,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <MasterKeyProvider>
      <ListViewPreferencesProvider userId={userId}>
        <div className="flex min-h-screen flex-1 flex-col md:flex-row">
          <Sidebar
            userId={userId}
            firstName={firstName}
            lastName={lastName}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
          <main className="flex-1 p-6 md:p-10">
            <AIChatProvider>{children}</AIChatProvider>
          </main>
        </div>
      </ListViewPreferencesProvider>
    </MasterKeyProvider>
  );
}
