"use client";

import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import type { AIAnalysisScope, AnalysisProgress, SavedAnalysisState } from "@/domain/ai/analyze-document";

/** Sempre un segnale che la lettura è in corso; per i documenti lunghi, in più parti, anche a che punto si è. */
function ProgressStatus({ progress }: { progress: AnalysisProgress | null }) {
  const multiPart = !!progress && progress.total >= 2;
  const merging = progress?.phase === "merging";
  const done = multiPart ? (merging ? progress.total : progress.current - 1) : 0;
  const percent = multiPart ? Math.round((done / progress.total) * 100) : 0;
  return (
    <div role="status" aria-live="polite" className="flex w-full max-w-sm flex-col gap-1">
      <p className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <Spinner />
        {!multiPart
          ? "Hinthia sta leggendo il documento…"
          : merging
            ? `Letto tutto (${progress.total} parti): preparo la sintesi…`
            : `Leggo la parte ${progress.current} di ${progress.total}…`}
      </p>
      {multiPart ? (
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
      ) : null}
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
  savedState = { kind: "none" },
  analyzedAtLabel = null,
  lastRunFailed = false,
  onAnalyze,
  onAbort,
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
  /** Che cosa c'è già di salvato: una lettura completa non si rifà da sola, una interrotta si riprende. */
  savedState?: SavedAnalysisState;
  /** Quando è stata salvata l'ultima lettura, già formattato. */
  analyzedAtLabel?: string | null;
  /** L'ultima lettura si è fermata per un errore, non per una scelta dell'utente. */
  lastRunFailed?: boolean;
  /** `force` = "Rileggi da capo": ignora la lettura salvata. */
  onAnalyze: (scope: AIAnalysisScope, options?: { force?: boolean }) => void;
  onAbort?: () => void;
  onToggleExcluded: (next: boolean) => void;
}) {
  const consentActive = masterEnabled && extractionConsent;
  const alreadyRead = savedState.kind === "complete";
  const resumable = savedState.kind === "interrupted" || savedState.kind === "merge-pending";
  // "Rileggi da capo" ha lo stesso consenso della prima lettura; senza un permesso di categoria vale "solo questa volta".
  const rereadScope: AIAnalysisScope = hasCategory && categoryEnabled ? "category" : "once";
  const primaryLabel = busy
    ? "Sto leggendo…"
    : savedState.kind === "interrupted"
      ? `Riprendi la lettura (${savedState.done} di ${savedState.total})`
      : savedState.kind === "merge-pending"
        ? "Prepara la sintesi finale"
        : "Chiedi a Hinthia";

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
      ) : alreadyRead ? (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {analyzedAtLabel ? `Hinthia ha già letto questo documento il ${analyzedAtLabel}.` : "Hinthia ha già letto questo documento."}{" "}
          Quello che ha trovato è qui sotto, senza una nuova lettura.
        </p>
      ) : hasCategory && categoryEnabled ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnalyze("category")}
          className="w-fit rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {primaryLabel}
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
            {resumable ? primaryLabel : "Solo questa volta"}
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

      {!excluded && consentActive && !busy && (resumable || savedState.kind === "stale") ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {savedState.kind === "stale"
            ? "La lettura salvata riguarda una versione precedente: una nuova lettura la sostituisce."
            : lastRunFailed
              ? "L'ultima lettura si è fermata per un errore: ciò che era già stato letto è al sicuro."
              : "L'ultima lettura è stata interrotta: ciò che era già stato letto è al sicuro."}
        </p>
      ) : null}

      {busy ? (
        <div className="flex flex-wrap items-center gap-3">
          <ProgressStatus progress={progress} />
          {onAbort ? (
            <button
              type="button"
              onClick={onAbort}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Interrompi
            </button>
          ) : null}
        </div>
      ) : null}

      {!excluded && consentActive && !busy && savedState.kind !== "none" ? (
        <button
          type="button"
          onClick={() => onAnalyze(rereadScope, { force: true })}
          className="w-fit rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Rileggi da capo
        </button>
      ) : null}

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
