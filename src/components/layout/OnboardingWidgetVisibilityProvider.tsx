"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getStoredOnboardingWidgetHidden, storeOnboardingWidgetHidden } from "@/lib/onboarding-widget";

interface OnboardingWidgetVisibilityContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const OnboardingWidgetVisibilityContext = createContext<OnboardingWidgetVisibilityContextValue | null>(
  null,
);

/**
 * Se il gadget "Onboarding" nella barra di navigazione è nascosto (v.
 * lib/onboarding-widget.ts, solo su questo dispositivo) --- condiviso
 * tra OnboardingStatus (che lo mostra/nasconde e offre il pulsante
 * "Nascondi" nel proprio pannello) e OnboardingSettingsPanel (che offre
 * lo stesso interruttore in Impostazioni > Onboarding). Serve un
 * contesto invece che i due componenti leggano ciascuno la propria
 * copia di localStorage: la barra laterale resta montata attraversando
 * le navigazioni interne dell'app, quindi senza uno stato condiviso non
 * si accorgerebbe di un cambiamento fatto da Impostazioni nella stessa
 * scheda del browser.
 */
export function OnboardingWidgetVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    // Legge una preferenza già decisa altrove (localStorage), non deriva
    // stato da props/state React --- v. Sidebar.tsx per lo stesso pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHiddenState(getStoredOnboardingWidgetHidden());
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    storeOnboardingWidgetHidden(next);
  }, []);

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
