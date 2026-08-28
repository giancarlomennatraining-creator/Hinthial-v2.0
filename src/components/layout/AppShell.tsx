import { MainNav } from "@/components/layout/MainNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";

/**
 * Shared chrome for the authenticated app (sidebar nav + user menu).
 *
 * Purely presentational --- the caller (src/app/(app)/layout.tsx) is
 * responsible for checking that a user is signed in before rendering
 * this, since that's where the real Supabase session check happens.
 */
export function AppShell({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-zinc-200 p-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:p-6 dark:border-zinc-800">
        <span className="px-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-auto w-full" />
        </span>
        <MainNav />
        <div className="mt-auto">
          <UserMenu displayName={displayName} />
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">
        <MasterKeyProvider>{children}</MasterKeyProvider>
      </main>
    </div>
  );
}
