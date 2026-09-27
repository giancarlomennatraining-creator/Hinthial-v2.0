"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  updateAIChatConsent,
  updateAIExtractionConsent,
  updateAIHealthConsent,
  updateAIMasterEnabled,
  updateAIProactiveAlertsConsent,
  updateAITranscriptionConsent,
} from "@/domain/profile/repository";

interface AIProcessingConsentContextValue {
  /** "Cancello" generale: deve essere true perché un qualunque consenso specifico abbia effetto. */
  masterEnabled: boolean;
  /** Spegnerlo spegne anche ogni consenso specifico nella stessa richiesta; riaccenderlo non li riaccende da solo. */
  setMasterEnabled: (next: boolean) => Promise<void>;
  /** Consenso alla Chat reale: effetto solo se masterEnabled è true. */
  chatConsent: boolean;
  setChatConsent: (next: boolean) => Promise<void>;
  /** Consenso all'estrazione avanzata (non ancora costruita): imposta già oggi la preferenza. */
  extractionConsent: boolean;
  /** Spegnerlo spegne anche healthConsent e proactiveAlertsConsent, che dipendono da questo. */
  setExtractionConsent: (next: boolean) => Promise<void>;
  /** Eccezione per la categoria Salute dentro l'estrazione avanzata: effetto solo se extractionConsent è true. */
  healthConsent: boolean;
  setHealthConsent: (next: boolean) => Promise<void>;
  /** Consenso alla trascrizione audio/video reale (non ancora costruita). */
  transcriptionConsent: boolean;
  setTranscriptionConsent: (next: boolean) => Promise<void>;
  /** Consenso agli avvisi proattivi (non ancora costruita): effetto solo se extractionConsent è anche true. */
  proactiveAlertsConsent: boolean;
  setProactiveAlertsConsent: (next: boolean) => Promise<void>;
}

const AIProcessingConsentContext = createContext<AIProcessingConsentContextValue | null>(null);

/**
 * Consenso esplicito all'elaborazione AI reale: un "cancello" generale (masterEnabled) sopra consensi specifici per
 * singola funzione. Oggi solo chatConsent ha una funzione reale dietro (la Chat, v. AIPanel); gli altri sono
 * preferenze già impostabili per funzioni non ancora costruite. Sincronizzato sul server (profiles.ai_*): il valore
 * iniziale arriva già letto lato server per evitare uno stato sbagliato al primo render.
 */
export function AIProcessingConsentProvider({
  userId,
  initialMasterEnabled,
  initialChatConsent,
  initialExtractionConsent,
  initialHealthConsent,
  initialTranscriptionConsent,
  initialProactiveAlertsConsent,
  children,
}: {
  userId: string;
  initialMasterEnabled: boolean;
  initialChatConsent: boolean;
  initialExtractionConsent: boolean;
  initialHealthConsent: boolean;
  initialTranscriptionConsent: boolean;
  initialProactiveAlertsConsent: boolean;
  children: React.ReactNode;
}) {
  const [masterEnabled, setMasterEnabledState] = useState(initialMasterEnabled);
  const [chatConsent, setChatConsentState] = useState(initialChatConsent);
  const [extractionConsent, setExtractionConsentState] = useState(initialExtractionConsent);
  const [healthConsent, setHealthConsentState] = useState(initialHealthConsent);
  const [transcriptionConsent, setTranscriptionConsentState] = useState(initialTranscriptionConsent);
  const [proactiveAlertsConsent, setProactiveAlertsConsentState] = useState(initialProactiveAlertsConsent);

  const setMasterEnabled = useCallback(
    async (next: boolean) => {
      const previous = {
        master: masterEnabled,
        chat: chatConsent,
        extraction: extractionConsent,
        health: healthConsent,
        transcription: transcriptionConsent,
        alerts: proactiveAlertsConsent,
      };
      setMasterEnabledState(next); // ottimistico: la UI risponde subito
      if (!next) {
        // spegnere il cancello spegne anche ogni consenso specifico
        setChatConsentState(false);
        setExtractionConsentState(false);
        setHealthConsentState(false);
        setTranscriptionConsentState(false);
        setProactiveAlertsConsentState(false);
      }

      try {
        const supabase = createClient();
        await updateAIMasterEnabled(supabase, userId, next);
      } catch (err) {
        setMasterEnabledState(previous.master); // il server non ha salvato: si torna indietro
        setChatConsentState(previous.chat);
        setExtractionConsentState(previous.extraction);
        setHealthConsentState(previous.health);
        setTranscriptionConsentState(previous.transcription);
        setProactiveAlertsConsentState(previous.alerts);
        throw err;
      }
    },
    [masterEnabled, chatConsent, extractionConsent, healthConsent, transcriptionConsent, proactiveAlertsConsent, userId],
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
      const previousExtraction = extractionConsent;
      const previousHealth = healthConsent;
      const previousAlerts = proactiveAlertsConsent;
      setExtractionConsentState(next);
      if (!next) {
        // spegnere l'estrazione avanzata spegne anche ciò che dipende da essa
        setHealthConsentState(false);
        setProactiveAlertsConsentState(false);
      }

      try {
        const supabase = createClient();
        await updateAIExtractionConsent(supabase, userId, next);
      } catch (err) {
        setExtractionConsentState(previousExtraction);
        setHealthConsentState(previousHealth);
        setProactiveAlertsConsentState(previousAlerts);
        throw err;
      }
    },
    [extractionConsent, healthConsent, proactiveAlertsConsent, userId],
  );

  const setHealthConsent = useCallback(
    async (next: boolean) => {
      const previous = healthConsent;
      setHealthConsentState(next);

      try {
        const supabase = createClient();
        await updateAIHealthConsent(supabase, userId, next);
      } catch (err) {
        setHealthConsentState(previous);
        throw err;
      }
    },
    [healthConsent, userId],
  );

  const setTranscriptionConsent = useCallback(
    async (next: boolean) => {
      const previous = transcriptionConsent;
      setTranscriptionConsentState(next);

      try {
        const supabase = createClient();
        await updateAITranscriptionConsent(supabase, userId, next);
      } catch (err) {
        setTranscriptionConsentState(previous);
        throw err;
      }
    },
    [transcriptionConsent, userId],
  );

  const setProactiveAlertsConsent = useCallback(
    async (next: boolean) => {
      const previous = proactiveAlertsConsent;
      setProactiveAlertsConsentState(next);

      try {
        const supabase = createClient();
        await updateAIProactiveAlertsConsent(supabase, userId, next);
      } catch (err) {
        setProactiveAlertsConsentState(previous);
        throw err;
      }
    },
    [proactiveAlertsConsent, userId],
  );

  const value = useMemo<AIProcessingConsentContextValue>(
    () => ({
      masterEnabled,
      setMasterEnabled,
      chatConsent,
      setChatConsent,
      extractionConsent,
      setExtractionConsent,
      healthConsent,
      setHealthConsent,
      transcriptionConsent,
      setTranscriptionConsent,
      proactiveAlertsConsent,
      setProactiveAlertsConsent,
    }),
    [
      masterEnabled,
      setMasterEnabled,
      chatConsent,
      setChatConsent,
      extractionConsent,
      setExtractionConsent,
      healthConsent,
      setHealthConsent,
      transcriptionConsent,
      setTranscriptionConsent,
      proactiveAlertsConsent,
      setProactiveAlertsConsent,
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
