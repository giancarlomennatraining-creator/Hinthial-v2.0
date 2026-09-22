"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";

/**
 * Impostazioni -> Intelligenza artificiale: il "cancello" generale per
 * l'IA reale (v. HINTHIAL_MVP.md, "Explicit AI processing") più le
 * funzioni specifiche che dipendono da esso. Stesso componente riusato
 * anche dentro il pannello ⚙ della pagina AI (v. AIPanel): un'unica
 * implementazione della logica di consenso, non due copie sincronizzate.
 * Spegnere il cancello spegne anche le funzioni sotto; riaccenderlo non
 * le riaccende da solo --- ogni funzione resta una scelta esplicita a sé.
 *
 * Solo "Chat" ha oggi una funzione reale dietro. Le altre quattro
 * (Estrazione avanzata, Salute, Trascrizione, Avvisi proattivi)
 * corrispondono a fasi del piano (FASI 22/22b/24) non ancora costruite:
 * attivarle oggi non ha alcun effetto reale, salvo impostare già la
 * preferenza per quando quella funzione esisterà --- v. richiesta utente
 * di preparare il consenso in anticipo, in forma il più possibile
 * semplice (una riga SI/NO per funzione, non un elenco di categorie).
 * "Avvisi proattivi" resta disabilitato finché "Estrazione avanzata" non
 * è attiva: non esiste modo di generare un avviso senza aver prima letto
 * i contenuti (v. HINTHIAL_MVP.md, FASE 24, "non esiste una terza via").
 */
export function AIConsentSettings() {
  const {
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
  } = useAIProcessingConsent();

  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionError, setExtractionError] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [transcriptionBusy, setTranscriptionBusy] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsError, setAlertsError] = useState(false);

  async function handleMasterChange(next: boolean) {
    setMasterError(false);
    setMasterBusy(true);
    try {
      await setMasterEnabled(next);
    } catch {
      setMasterError(true);
    } finally {
      setMasterBusy(false);
    }
  }

  async function handleChatChange(next: boolean) {
    setChatError(false);
    setChatBusy(true);
    try {
      await setChatConsent(next);
    } catch {
      setChatError(true);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleExtractionChange(next: boolean) {
    setExtractionError(false);
    setExtractionBusy(true);
    try {
      await setExtractionConsent(next);
    } catch {
      setExtractionError(true);
    } finally {
      setExtractionBusy(false);
    }
  }

  async function handleHealthChange(next: boolean) {
    setHealthError(false);
    setHealthBusy(true);
    try {
      await setHealthConsent(next);
    } catch {
      setHealthError(true);
    } finally {
      setHealthBusy(false);
    }
  }

  async function handleTranscriptionChange(next: boolean) {
    setTranscriptionError(false);
    setTranscriptionBusy(true);
    try {
      await setTranscriptionConsent(next);
    } catch {
      setTranscriptionError(true);
    } finally {
      setTranscriptionBusy(false);
    }
  }

  async function handleAlertsChange(next: boolean) {
    setAlertsError(false);
    setAlertsBusy(true);
    try {
      await setProactiveAlertsConsent(next);
    } catch {
      setAlertsError(true);
    } finally {
      setAlertsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Consenti l&apos;uso di IA esterna (Claude)
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Cancello generale --- deve essere acceso perché una qualunque funzione basata su IA
            reale possa essere attivata qui sotto. Spegnerlo spegne anche le funzioni già attive.
          </p>
          {masterError ? (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              Preferenza non salvata.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={masterEnabled}
          aria-label="Consenti l'uso di IA esterna"
          disabled={masterBusy}
          onClick={() => handleMasterChange(!masterEnabled)}
          className={cn(
            "shrink-0 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50",
            masterEnabled
              ? "bg-brand text-white hover:bg-brand-hover"
              : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
          )}
        >
          {masterEnabled ? "Disattiva" : "Attiva"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Funzioni specifiche
        </p>
        <ul className="flex flex-col gap-1 rounded-md border border-zinc-300 p-1 dark:border-zinc-700">
          <li>
            <label
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                masterEnabled
                  ? "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
              )}
            >
              <input
                type="checkbox"
                checked={chatConsent}
                disabled={!masterEnabled || chatBusy}
                onChange={() => handleChatChange(!chatConsent)}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              Chat --- risposte reali alle tue domande (v. pagina AI)
            </label>
          </li>

          <li>
            <label
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                masterEnabled
                  ? "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
              )}
            >
              <input
                type="checkbox"
                checked={extractionConsent}
                disabled={!masterEnabled || extractionBusy}
                onChange={() => handleExtractionChange(!extractionConsent)}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              Estrazione avanzata dei contenuti --- non ancora disponibile, imposta già la
              preferenza
            </label>
          </li>

          <li className="ml-4 border-l-2 border-amber-200 pl-2 dark:border-amber-900">
            <label
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                masterEnabled && extractionConsent
                  ? "cursor-pointer text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
              )}
            >
              <input
                type="checkbox"
                checked={healthConsent}
                disabled={!masterEnabled || !extractionConsent || healthBusy}
                onChange={() => handleHealthChange(!healthConsent)}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              🔒 Includi anche la categoria Salute --- consenso ulteriore, richiede l&apos;estrazione
              avanzata attiva
            </label>
          </li>

          <li>
            <label
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                masterEnabled
                  ? "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
              )}
            >
              <input
                type="checkbox"
                checked={transcriptionConsent}
                disabled={!masterEnabled || transcriptionBusy}
                onChange={() => handleTranscriptionChange(!transcriptionConsent)}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              Trascrizione audio/video --- non ancora disponibile, imposta già la preferenza
            </label>
          </li>

          <li>
            <label
              className={cn(
                "flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium",
                masterEnabled && extractionConsent
                  ? "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
              )}
            >
              <input
                type="checkbox"
                checked={proactiveAlertsConsent}
                disabled={!masterEnabled || !extractionConsent || alertsBusy}
                onChange={() => handleAlertsChange(!proactiveAlertsConsent)}
                className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
              />
              Generazione di avvisi proattivi --- richiede l&apos;estrazione avanzata attiva
            </label>
          </li>
        </ul>
        {chatError || extractionError || healthError || transcriptionError || alertsError ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            Preferenza non salvata.
          </p>
        ) : null}
      </div>
    </div>
  );
}
