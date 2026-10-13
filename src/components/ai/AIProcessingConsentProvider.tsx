"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  updateAIChatConsent,
  updateAIExtractionConsent,
  updateAIMasterEnabled,
} from "@/domain/profile/repository";

interface AIProcessingConsentContextValue {
  /** "Cancello" generale: deve essere true perché un qualunque consenso specifico abbia effetto. */
  masterEnabled: boolean;
  /** Spegnerlo spegne anche ogni consenso specifico nella stessa richiesta; riaccenderlo non li riaccende da solo. */
  setMasterEnabled: (next: boolean) => Promise<void>;
  /** Consenso alla Chat reale: effetto solo se masterEnabled è true. */
  chatConsent: boolean;
  setChatConsent: (next: boolean) => Promise<void>;
  /** Consenso generale all'estrazione avanzata (FASE 22) --- il consenso vero e proprio è per categoria, v. domain/categories. */
  extractionConsent: boolean;
  setExtractionConsent: (next: boolean) => Promise<void>;
}

const AIProcessingConsentContext = createContext<AIProcessingConsentContextValue | null>(null);

/**
 * Consenso esplicito all'elaborazione AI reale: un "cancello" generale (masterEnabled) sopra consensi specifici per
 * singola funzione: Chat (FASE 11) ed estrazione avanzata (FASE 22). Il consenso per categoria dell'estrazione
 * avanzata vive però su categories.ai_extraction_enabled (v. domain/categories/repository.ts), non qui --- questo resta
 * solo il cancello generale della funzione. Sincronizzato sul server (profiles.ai_*): il
 * valore iniziale arriva già letto lato server per evitare uno stato sbagliato al primo render.
 */
export function AIProcessingConsentProvider({
  userId,
  initialMasterEnabled,
  initialChatConsent,
  initialExtractionConsent,
  children,
}: {
  userId: string;
  initialMasterEnabled: boolean;
  initialChatConsent: boolean;
  initialExtractionConsent: boolean;
  children: React.ReactNode;
}) {
  const [masterEnabled, setMasterEnabledState] = useState(initialMasterEnabled);
  const [chatConsent, setChatConsentState] = useState(initialChatConsent);
  const [extractionConsent, setExtractionConsentState] = useState(initialExtractionConsent);

  const setMasterEnabled = useCallback(
    async (next: boolean) => {
      const previous = {
        master: masterEnabled,
        chat: chatConsent,
        extraction: extractionConsent,
      };
      setMasterEnabledState(next); // ottimistico: la UI risponde subito
      if (!next) {
        // spegnere il cancello spegne anche ogni consenso specifico
        setChatConsentState(false);
        setExtractionConsentState(false);
      }

      try {
        const supabase = createClient();
        await updateAIMasterEnabled(supabase, userId, next);
      } catch (err) {
        setMasterEnabledState(previous.master); // il server non ha salvato: si torna indietro
        setChatConsentState(previous.chat);
        setExtractionConsentState(previous.extraction);
        throw err;
      }
    },
    [masterEnabled, chatConsent, extractionConsent, userId],
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

  const setExtractionConsent = useCallback(
    async (next: boolean) => {
      const previous = extractionConsent;
      setExtractionConsentState(next);

      try {
        const supabase = createClient();
        await updateAIExtractionConsent(supabase, userId, next);
      } catch (err) {
        setExtractionConsentState(previous);
        throw err;
      }
    },
    [extractionConsent, userId],
  );

  const value = useMemo<AIProcessingConsentContextValue>(
    () => ({
      masterEnabled,
      setMasterEnabled,
      chatConsent,
      setChatConsent,
      extractionConsent,
      setExtractionConsent,
    }),
    [
      masterEnabled,
      setMasterEnabled,
      chatConsent,
      setChatConsent,
      extractionConsent,
      setExtractionConsent,
    ],
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
