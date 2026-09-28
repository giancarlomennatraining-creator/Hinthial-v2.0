"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { cn } from "@/lib/utils";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { listCategories, setCategoryAIExtractionEnabled } from "@/domain/categories/repository";
import { sortAlphabetically } from "@/lib/utils";
import type { Category } from "@/domain/categories/types";

/**
 * Impostazioni -> Intelligenza artificiale: il "cancello" generale per l'IA reale più le funzioni specifiche che ne
 * dipendono, riusato anche nel pannello ⚙ della pagina AI. Spegnere il cancello spegne anche le funzioni sotto;
 * riaccenderlo non le riaccende da solo. Chat ed Estrazione avanzata hanno oggi una funzione reale dietro
 * (rispettivamente FASE 11 e FASE 22); le altre due non sono ancora costruite, attivarle imposta solo già la
 * preferenza. "Avvisi proattivi" resta disabilitato finché "Estrazione avanzata" non è attiva: non esiste modo di
 * generare un avviso senza aver prima letto i contenuti.
 *
 * FASE 22: il consenso all'estrazione avanzata è a due livelli --- questo generale, poi per categoria (elenco sotto,
 * Salute inclusa come una categoria come le altre, non più un'eccezione a parte).
 */
export function AIConsentSettings() {
  const {
    masterEnabled,
    setMasterEnabled,
    chatConsent,
    setChatConsent,
    extractionConsent,
    setExtractionConsent,
    transcriptionConsent,
    setTranscriptionConsent,
    proactiveAlertsConsent,
    setProactiveAlertsConsent,
  } = useAIProcessingConsent();

  const supabase = useRef(createClient()).current;
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);

  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState(false);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionError, setExtractionError] = useState(false);
  const [transcriptionBusy, setTranscriptionBusy] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [alertsError, setAlertsError] = useState(false);

  const refreshCategories = useCallback(async () => {
    setCategoriesError(false);
    try {
      setCategories(await listCategories(supabase));
    } catch {
      setCategoriesError(true);
    }
  }, [supabase]);

  useEffect(() => {
    // Vedi DocumentsPanel.tsx per il motivo per cui fetch-on-mount è legittimo qui.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCategories();
  }, [refreshCategories]);

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

  async function handleCategoryToggle(category: Category, next: boolean) {
    setBusyCategoryId(category.id);
    setCategoriesError(false);
    try {
      await setCategoryAIExtractionEnabled(supabase, category.id, next);
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, aiExtractionEnabled: next } : c)),
      );
    } catch {
      setCategoriesError(true);
    } finally {
      setBusyCategoryId(null);
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
              🔒 Estrazione avanzata dei contenuti --- Claude legge il testo dei documenti delle
              categorie che abiliti qui sotto
            </label>
          </li>

          <li className="ml-4 flex flex-col gap-1 border-l-2 border-zinc-200 pl-2 dark:border-zinc-800">
            <p
              className={cn(
                "text-xs",
                masterEnabled && extractionConsent
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-400 dark:text-zinc-600",
              )}
            >
              Categorie abilitate all&apos;estrazione avanzata --- spento di default per ognuna,
              anche Salute:
            </p>
            {categoriesError ? (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                Impossibile caricare o salvare le categorie.
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {sortAlphabetically(categories, (c) => c.name).map((category) => (
                <li key={category.id}>
                  <label
                    className={cn(
                      "flex items-center gap-2 rounded px-3 py-1 text-sm",
                      masterEnabled && extractionConsent
                        ? "cursor-pointer text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        : "cursor-not-allowed text-zinc-400 dark:text-zinc-600",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={category.aiExtractionEnabled}
                      disabled={!masterEnabled || !extractionConsent || busyCategoryId === category.id}
                      onChange={() => handleCategoryToggle(category, !category.aiExtractionEnabled)}
                      className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
                    />
                    {category.icon} {category.name}
                  </label>
                </li>
              ))}
            </ul>
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
        {chatError || extractionError || transcriptionError || alertsError ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            Preferenza non salvata.
          </p>
        ) : null}
      </div>
    </div>
  );
}
