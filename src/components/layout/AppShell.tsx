"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavBar } from "@/components/layout/MobileNavBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { MasterKeyProvider } from "@/components/crypto/MasterKeyProvider";
import { MasterKeyIntroModal } from "@/components/crypto/MasterKeyIntroModal";
import { UnlockPromptProvider } from "@/components/crypto/UnlockPromptProvider";
import { LoginSplashProvider } from "@/components/layout/LoginSplashProvider";
import { OnboardingWidgetVisibilityProvider } from "@/components/layout/OnboardingWidgetVisibilityProvider";
import { AIProcessingConsentProvider } from "@/components/ai/AIProcessingConsentProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AuditWriteFailedNotice } from "@/components/audit/AuditWriteFailedNotice";

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
  initialOnboardingWidgetHidden,
  initialMasterKeyIntroSeen,
  initialAIMasterEnabled,
  initialAIChatConsent,
  initialAIExtractionConsent,
  children,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  initialOnboardingWidgetHidden: boolean;
  initialMasterKeyIntroSeen: boolean;
  initialAIMasterEnabled: boolean;
  initialAIChatConsent: boolean;
  initialAIExtractionConsent: boolean;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
    <LoginSplashProvider>
    <MasterKeyProvider>
    <UnlockPromptProvider>
      <MasterKeyIntroModal userId={userId} initialSeen={initialMasterKeyIntroSeen} />
      <AuditWriteFailedNotice />
      <OnboardingWidgetVisibilityProvider userId={userId} initialHidden={initialOnboardingWidgetHidden}>
        <AIProcessingConsentProvider
          userId={userId}
          initialMasterEnabled={initialAIMasterEnabled}
          initialChatConsent={initialAIChatConsent}
          initialExtractionConsent={initialAIExtractionConsent}
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
    </UnlockPromptProvider>
    </MasterKeyProvider>
    </LoginSplashProvider>
    </ToastProvider>
  );
}

/** Il guscio dell'app: barra laterale (da md in su), barra in alto con il menu e barra in basso su smartphone. */
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
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
      <main className="flex-1 px-6 pt-6 pb-24 md:px-10 md:pt-10 md:pb-10">
        {children}
      </main>
      <BottomNavBar />
    </div>
  );
}
