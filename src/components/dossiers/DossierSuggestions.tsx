"use client";

import type { NewDossierSuggestion } from "@/domain/dossiers/suggestions";

/**
 * Hinthial ha notato che alcuni documenti vanno insieme (lo stesso bene, nessun fascicolo) e propone di metterli in un
 * fascicolo. Accettare crea il fascicolo e vi collega i documenti; "Non ora" lo ricorda sul dispositivo.
 */
export function DossierSuggestions({
  suggestions,
  busyKey,
  onAccept,
  onDismiss,
}: {
  suggestions: NewDossierSuggestion[];
  busyKey: string | null;
  onAccept: (suggestion: NewDossierSuggestion) => void;
  onDismiss: (suggestion: NewDossierSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section aria-label="Fascicoli suggeriti" className="flex flex-col gap-2.5">
      {suggestions.map((suggestion) => {
        const busy = busyKey === suggestion.assetId;
        const shown = suggestion.filenames.slice(0, 3).join(", ");
        const more = suggestion.filenames.length - 3;
        return (
          <div
            key={suggestion.assetId}
            className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[14px] border border-[#cdd8fa] bg-[#f3f6ff] px-4 py-3 dark:border-brand/40 dark:bg-brand/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white dark:bg-zinc-950" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b4fc4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" />
                <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7Z" />
              </svg>
            </span>
            <p className="min-w-0 flex-1 basis-64 text-[13.5px] leading-snug text-[#3d4670] dark:text-zinc-300">
              <span className="font-bold text-[#121a35] dark:text-zinc-100">
                Hai {suggestion.documentIds.length} documenti di &laquo;{suggestion.title}&raquo; senza un fascicolo.
              </span>{" "}
              Vuoi riunirli in un fascicolo? <span className="text-[#5b6483] dark:text-zinc-400">{shown}{more > 0 ? ` e altri ${more}` : ""}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(suggestion)}
                className="rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {busy ? "Creo…" : "Crea il fascicolo"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDismiss(suggestion)}
                className="rounded-[10px] border border-[#c9d0e6] bg-white px-3.5 py-2 text-[13px] font-bold text-[#3d4670] hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              >
                Non ora
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
