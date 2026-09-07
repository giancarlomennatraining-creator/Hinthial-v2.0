"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateOnboardingWidgetHidden } from "@/domain/profile/repository";

interface OnboardingWidgetVisibilityContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const OnboardingWidgetVisibilityContext = createContext<OnboardingWidgetVisibilityContextValue | null>(
  null,
);

/**
 * Se il gadget "Onboarding" nella barra di navigazione è nascosto ---
 * sincronizzato sul server (profiles.onboarding_widget_hidden), come la
 * disposizione del menu (v. NavOrientationProvider): così "Nascondi" vale
 * per davvero anche a un login successivo, non solo su questo browser.
 * Il valore iniziale arriva già letto lato server (v.
 * AppShell/getCurrentUser), per evitare un lampo del gadget al primo
 * render. Condiviso tra OnboardingStatus (che lo mostra/nasconde e offre
 * il pulsante "Nascondi" nel proprio pannello) e OnboardingSettingsPanel
 * (che offre lo stesso interruttore in Impostazioni > Onboarding).
 */
export function OnboardingWidgetVisibilityProvider({
  userId,
  initialHidden,
  children,
}: {
  userId: string;
  initialHidden: boolean;
  children: React.ReactNode;
}) {
  const [hidden, setHiddenState] = useState(initialHidden);

  const setHidden = useCallback(
    (next: boolean) => {
      const previous = hidden;
      setHiddenState(next); // optimistic: il gadget sparisce/ricompare subito

      const supabase = createClient();
      updateOnboardingWidgetHidden(supabase, userId, next).catch(() => {
        setHiddenState(previous); // il server non ha salvato: si torna indietro
      });
    },
    [hidden, userId],
  );

  const value = useMemo<OnboardingWidgetVisibilityContextValue>(
    () => ({ hidden, setHidden }),
    [hidden, setHidden],
  );

  return (
    <OnboardingWidgetVisibilityContext.Provider value={value}>
      {children}
    </OnboardingWidgetVisibilityContext.Provider>
  );
}

export function useOnboardingWidgetVisibility(): OnboardingWidgetVisibilityContextValue {
  const ctx = useContext(OnboardingWidgetVisibilityContext);
  if (!ctx) {
    throw new Error(
      "useOnboardingWidgetVisibility must be used within a OnboardingWidgetVisibilityProvider",
    );
  }
  return ctx;
}
