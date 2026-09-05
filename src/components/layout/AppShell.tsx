"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";
import { ListViewPreferencesProvider } from "@/components/layout/ListViewPreferencesProvider";
import { NavOrientationProvider, useNavOrientation } from "@/components/layout/NavOrientationProvider";
import { OnboardingWidgetVisibilityProvider } from "@/components/layout/OnboardingWidgetVisibilityProvider";
import { AIChatProvider } from "@/components/ai/AIChatProvider";
import { cn } from "@/lib/utils";
import type { NavOrientation } from "@/lib/nav-orientation";

/**
 * Shared chrome for the authenticated app (nav + user menu).
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
  initialNavOrientation,
  children,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  initialNavOrientation: NavOrientation;
  children: React.ReactNode;
}) {
  return (
    <MasterKeyProvider>
      <NavOrientationProvider userId={userId} initialOrientation={initialNavOrientation}>
        <ListViewPreferencesProvider userId={userId}>
          <OnboardingWidgetVisibilityProvider>
            <AppChrome
              userId={userId}
              firstName={firstName}
              lastName={lastName}
              displayName={displayName}
              avatarUrl={avatarUrl}
            >
              {children}
            </AppChrome>
          </OnboardingWidgetVisibilityProvider>
        </ListViewPreferencesProvider>
      </NavOrientationProvider>
    </MasterKeyProvider>
  );
}

/**
 * Sceglie tra i tre layout in base alla disposizione scelta in
 * Impostazioni > Aspetto (v. NavOrientationProvider) --- separato da
 * AppShell solo perché un componente non può leggere il contesto che
 * lui stesso definisce un livello più in alto.
 */
function AppChrome({
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
  const { orientation } = useNavOrientation();

  if (orientation === "topbar") {
    return (
      <div className="flex min-h-screen flex-1 flex-col">
        <TopNav
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
    );
  }

  const side = orientation === "sidebar-right" ? "right" : "left";

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar
        side={side}
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
      <main className={cn("flex-1 p-6 md:p-10", side === "right" ? "md:order-1" : undefined)}>
        <AIChatProvider>{children}</AIChatProvider>
      </main>
    </div>
  );
}
