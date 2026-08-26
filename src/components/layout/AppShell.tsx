"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMockSession } from "@/lib/auth/use-mock-session";
import { clearMockSession } from "@/lib/auth/mock-session";
import { MainNav } from "@/components/layout/MainNav";

/**
 * Shared chrome for the authenticated app (nav + topbar) and route guard.
 *
 * The guard relies on the FASE 1 mock session and redirects to /login when
 * absent. It will be replaced by real Supabase session checks in FASE 2.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const state = useMockSession();

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [state.status, router]);

  if (state.status !== "authenticated") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-zinc-200 p-4 md:w-56 md:shrink-0 md:border-b-0 md:border-r md:p-6 dark:border-zinc-800">
        <span className="px-3 text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          HINTHIAL
        </span>
        <MainNav />
        <div className="mt-auto flex flex-col gap-2 px-3 pt-6">
          <span className="truncate text-xs text-zinc-500 dark:text-zinc-500">
            {state.session.displayName}
          </span>
          <button
            type="button"
            onClick={() => {
              clearMockSession();
              router.push("/");
            }}
            className="self-start text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Esci
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
