"use client";

import Link from "next/link";
import type { AIAnalysisScope, AnalysisProgress } from "@/domain/ai/analyze-document";

/** Più parti = un documento lungo: solo lì ha senso dire a che punto si è. */
function ProgressStatus({ progress }: { progress: AnalysisProgress | null }) {
  if (!progress || progress.total < 2) return null;
  const merging = progress.phase === "merging";
  const done = merging ? progress.total : progress.current - 1;
  const percent = Math.round((done / progress.total) * 100);
  return (
    <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col gap-1">
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        {merging
          ? `Letto tutto (${progress.total} parti): preparo la sintesi…`
          : `Leggo la parte ${progress.current} di ${progress.total}…`}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={done}
        aria-label="Avanzamento della lettura"
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

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
  progress = null,
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
  /** Dove è arrivata la lettura mentre `busy`: serve per i documenti lunghi, in più parti. */
  progress?: AnalysisProgress | null;
  onAnalyze: (scope: AIAnalysisScope) => void;
  onToggleExcluded: (next: boolean) => void;
}) {
  const consentActive = masterEnabled && extractionConsent;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
        <img src="/brand/hinthia/hinthia-64.png" alt="" className="h-5 w-5 shrink-0 rounded-full" />
        Chiedi a Hinthia di leggere questo documento
      </p>

      {excluded ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Questo documento è escluso dall&apos;analisi di Hinthia — vince su qualunque consenso di categoria.
        </p>
      ) : !consentActive ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Attiva &quot;Estrazione avanzata dei contenuti&quot; in{" "}
          <Link href="/settings" className="underline underline-offset-2 hover:text-brand">
            Impostazioni → Hinthia
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
          {busy ? "Sto leggendo…" : "Chiedi a Hinthia"}
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

      {busy ? <ProgressStatus progress={progress} /> : null}

      <label className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <input
          type="checkbox"
          checked={excluded}
          onChange={() => onToggleExcluded(!excluded)}
          className="h-3.5 w-3.5 rounded border-zinc-300 text-brand focus:ring-brand dark:border-zinc-700"
        />
        Escludi questo documento dall&apos;analisi di Hinthia, anche con la categoria abilitata
      </label>
    </div>
  );
}
