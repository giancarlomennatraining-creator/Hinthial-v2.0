import { signOut } from "@/lib/auth/actions";
import { MainNav } from "@/components/layout/MainNav";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";

/**
 * Shared chrome for the authenticated app (sidebar nav + logout).
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
          <img src="/brand/logo.svg" alt="HINTHIAL" className="h-8 w-auto" />
        </span>
        <MainNav />
        <div className="mt-auto flex flex-col gap-2 px-3 pt-6">
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-500">
            {displayName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="self-start text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Esci
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">
        <MasterKeyProvider>{children}</MasterKeyProvider>
      </main>
    </div>
  );
}
