"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateAIProcessingConsent } from "@/domain/profile/repository";

interface AIProcessingConsentContextValue {
  consent: boolean;
  setConsent: (next: boolean) => Promise<void>;
}

const AIProcessingConsentContext = createContext<AIProcessingConsentContextValue | null>(null);

/**
 * Consenso esplicito all'elaborazione AI reale (v. HINTHIAL_MVP.md
 * sezione 8, "Explicit AI processing") --- senza questo consenso,
 * AIPanel usa solo mockAIProvider, mai un provider esterno. Sincronizzato
 * sul server (profiles.ai_processing_consent), come NavOrientationProvider:
 * il valore iniziale arriva già letto lato server, per evitare che la
 * pagina AI mostri per un istante lo stato sbagliato (banner di consenso
 * al posto della chat, o viceversa) al primo render.
 */
export function AIProcessingConsentProvider({
  userId,
  initialConsent,
  children,
}: {
  userId: string;
  initialConsent: boolean;
  children: React.ReactNode;
}) {
  const [consent, setConsentState] = useState(initialConsent);

  const setConsent = useCallback(
    async (next: boolean) => {
      const previous = consent;
      setConsentState(next); // ottimistico: la UI risponde subito

      try {
        const supabase = createClient();
        await updateAIProcessingConsent(supabase, userId, next);
      } catch (err) {
        setConsentState(previous); // il server non ha salvato: si torna indietro
        throw err;
      }
    },
    [consent, userId],
  );

  const value = useMemo<AIProcessingConsentContextValue>(
    () => ({ consent, setConsent }),
    [consent, setConsent],
  );

  return (
    <AIProcessingConsentContext.Provider value={value}>{children}</AIProcessingConsentContext.Provider>
  );
}

export function useAIProcessingConsent(): AIProcessingConsentContextValue {
  const ctx = useContext(AIProcessingConsentContext);
  if (!ctx) {
    throw new Error("useAIProcessingConsent must be used within an AIProcessingConsentProvider");
  }
  return ctx;
}
