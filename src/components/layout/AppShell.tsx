"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";
import { MasterKeyIntroModal } from "@/components/crypto/MasterKeyIntroModal";
import { ListViewPreferencesProvider } from "@/components/layout/ListViewPreferencesProvider";
import { NavOrientationProvider, useNavOrientation } from "@/components/layout/NavOrientationProvider";
import { BottomNavItemsProvider } from "@/components/layout/BottomNavItemsProvider";
import { MainNavItemsProvider } from "@/components/layout/MainNavItemsProvider";
import { OnboardingWidgetVisibilityProvider } from "@/components/layout/OnboardingWidgetVisibilityProvider";
import { AIChatProvider } from "@/components/ai/AIChatProvider";
import { AIProcessingConsentProvider } from "@/components/ai/AIProcessingConsentProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import type { NavOrientation } from "@/lib/nav-orientation";
import type { BottomNavItems } from "@/lib/bottom-nav";
import type { MainNavItems } from "@/lib/main-nav";

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
  initialBottomNavItems,
  initialMainNavItems,
  initialOnboardingWidgetHidden,
  initialMasterKeyIntroSeen,
  initialAIMasterEnabled,
  initialAIChatConsent,
  children,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  initialNavOrientation: NavOrientation;
  initialBottomNavItems: BottomNavItems;
  initialMainNavItems: MainNavItems;
  initialOnboardingWidgetHidden: boolean;
  initialMasterKeyIntroSeen: boolean;
  initialAIMasterEnabled: boolean;
  initialAIChatConsent: boolean;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
    <MasterKeyProvider>
      <MasterKeyIntroModal userId={userId} initialSeen={initialMasterKeyIntroSeen} />
      <NavOrientationProvider userId={userId} initialOrientation={initialNavOrientation}>
        <BottomNavItemsProvider userId={userId} initialItems={initialBottomNavItems}>
        <MainNavItemsProvider userId={userId} initialItems={initialMainNavItems}>
          <ListViewPreferencesProvider userId={userId}>
            <OnboardingWidgetVisibilityProvider userId={userId} initialHidden={initialOnboardingWidgetHidden}>
              <AIProcessingConsentProvider
                userId={userId}
                initialMasterEnabled={initialAIMasterEnabled}
                initialChatConsent={initialAIChatConsent}
              >
                <AppChrome
                  userId={userId}
                  firstName={firstName}
                  lastName={lastName}
                  displayName={displayName}
                  avatarUrl={avatarUrl}
                >
                  {children}
                </AppChrome>
              </AIProcessingConsentProvider>
            </OnboardingWidgetVisibilityProvider>
          </ListViewPreferencesProvider>
        </MainNavItemsProvider>
        </BottomNavItemsProvider>
      </NavOrientationProvider>
    </MasterKeyProvider>
    </ToastProvider>
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
        <MobileNavBar
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
        <TopNav
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          displayName={displayName}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 px-6 pt-6 pb-24 md:px-10 md:pt-10 md:pb-10">
          <AIChatProvider>{children}</AIChatProvider>
        </main>
        <BottomNavBar />
      </div>
    );
  }

  const side = orientation === "sidebar-right" ? "right" : "left";

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <MobileNavBar
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
      <Sidebar
        side={side}
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
      <main
        className={cn(
          "flex-1 px-6 pt-6 pb-24 md:px-10 md:pt-10 md:pb-10",
          side === "right" ? "md:order-1" : undefined,
        )}
      >
        <AIChatProvider>{children}</AIChatProvider>
      </main>
      <BottomNavBar />
    </div>
  );
}
