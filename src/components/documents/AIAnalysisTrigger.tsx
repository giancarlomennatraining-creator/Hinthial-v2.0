"use client";

import Link from "next/link";
import type { AIAnalysisScope } from "@/domain/ai/analyze-document";

/**
 * FASE 22: il bottone che manda per davvero il testo di un documento a Claude --- niente di automatico, un clic
 * esplicito per documento. Puramente presentazionale (come ProposalsSection): stato e chiamate vivono in
 * ArchiveItemDetail.tsx, incluso il window.confirm prima dell'invio (v. handleAnalyzeWithClaude).
 */
export function AIAnalysisTrigger({
  masterEnabled,
  extractionConsent,
  hasCategory,
  categoryEnabled,
  excluded,
  busy,
  onAnalyze,
  onToggleExcluded,
}: {
  masterEnabled: boolean;
  extractionConsent: boolean;
  /** Un documento senza categoria non può avere un consenso di categoria --- solo "solo questa volta" ha senso. */
  hasCategory: boolean;
  /** Vero se la categoria del documento è già abilitata, permanente o temporanea non ancora scaduta. */
  categoryEnabled: boolean;
  excluded: boolean;
  busy: boolean;
  onAnalyze: (scope: AIAnalysisScope) => void;
  onToggleExcluded: (next: boolean) => void;
}) {
  const consentActive = masterEnabled && extractionConsent;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          🔒 Chiedi a Claude di leggere questo documento
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">il testo lascia il dispositivo</p>
      </div>

      {excluded ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Questo documento è escluso dall&apos;analisi AI --- vince su qualunque consenso di categoria.
        </p>
      ) : !consentActive ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Attiva &quot;Estrazione avanzata dei contenuti&quot; in{" "}
          <Link href="/settings" className="underline underline-offset-2 hover:text-brand">
            Impostazioni → Intelligenza artificiale
          </Link>{" "}
          per usare questa funzione.
        </p>
      ) : hasCategory && categoryEnabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnalyze("category")}
          className="w-fit rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Sto leggendo…" : "Chiedi a Claude"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {hasCategory
              ? "La categoria di questo documento non è abilitata:"
              : "Questo documento non ha una categoria, quindi non può avere un consenso permanente:"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnalyze("once")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Solo questa volta
          </button>
          {hasCategory ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAnalyze("temporary")}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Abilita questa categoria per 30 giorni
            </button>
          ) : null}
          <Link
            href="/settings"
            className="text-xs text-zinc-500 underline underline-offset-2 hover:text-brand dark:text-zinc-400"
          >
            Vai alle Impostazioni
          </Link>
        </div>
      )}

      <label className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={excluded}
          onChange={() => onToggleExcluded(!excluded)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
        />
        Escludi questo documento dall&apos;analisi AI, anche con la categoria abilitata
      </label>
    </div>
  );
}
