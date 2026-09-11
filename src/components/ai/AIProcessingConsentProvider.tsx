"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { updateAIChatConsent, updateAIMasterEnabled } from "@/domain/profile/repository";

interface AIProcessingConsentContextValue {
  /** "Cancello" generale --- deve essere true perché un qualunque consenso specifico abbia effetto (v. HINTHIAL_MVP.md, "Explicit AI processing"). */
  masterEnabled: boolean;
  /** Spegnerlo spegne anche ogni consenso specifico nella stessa richiesta (v. domain/profile/repository.ts, updateAIMasterEnabled) --- riaccenderlo non li riaccende da solo. */
  setMasterEnabled: (next: boolean) => Promise<void>;
  /** Consenso specifico alla Chat reale --- ha effetto solo se masterEnabled è true. */
  chatConsent: boolean;
  setChatConsent: (next: boolean) => Promise<void>;
}

const AIProcessingConsentContext = createContext<AIProcessingConsentContextValue | null>(null);

/**
 * Consenso esplicito all'elaborazione AI reale (v. HINTHIAL_MVP.md
 * sezione 8, "Explicit AI processing"): un "cancello" generale
 * (masterEnabled) sopra consensi specifici per singola funzione (oggi
 * solo chatConsent, in futuro altri, es. per l'estrazione automatica) ---
 * nessuna funzione reale deve procedere se manca anche uno solo dei due.
 * Sincronizzato sul server (profiles.ai_master_enabled/ai_chat_consent),
 * come NavOrientationProvider: il valore iniziale arriva già letto lato
 * server, per evitare che le pagine che dipendono da questo stato
 * (pagina AI, Impostazioni > Privacy) mostrino per un istante lo stato
 * sbagliato al primo render.
 */
export function AIProcessingConsentProvider({
  userId,
  initialMasterEnabled,
  initialChatConsent,
  children,
}: {
  userId: string;
  initialMasterEnabled: boolean;
  initialChatConsent: boolean;
  children: React.ReactNode;
}) {
  const [masterEnabled, setMasterEnabledState] = useState(initialMasterEnabled);
  const [chatConsent, setChatConsentState] = useState(initialChatConsent);

  const setMasterEnabled = useCallback(
    async (next: boolean) => {
      const previousMaster = masterEnabled;
      const previousChat = chatConsent;
      setMasterEnabledState(next); // ottimistico: la UI risponde subito
      if (!next) setChatConsentState(false); // spegnere il cancello spegne anche i consensi specifici

      try {
        const supabase = createClient();
        await updateAIMasterEnabled(supabase, userId, next);
      } catch (err) {
        setMasterEnabledState(previousMaster); // il server non ha salvato: si torna indietro
        setChatConsentState(previousChat);
        throw err;
      }
    },
    [masterEnabled, chatConsent, userId],
  );

  const setChatConsent = useCallback(
    async (next: boolean) => {
      const previous = chatConsent;
      setChatConsentState(next);

      try {
        const supabase = createClient();
        await updateAIChatConsent(supabase, userId, next);
      } catch (err) {
        setChatConsentState(previous);
        throw err;
      }
    },
    [chatConsent, userId],
  );

  const value = useMemo<AIProcessingConsentContextValue>(
    () => ({ masterEnabled, setMasterEnabled, chatConsent, setChatConsent }),
    [masterEnabled, setMasterEnabled, chatConsent, setChatConsent],
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
