"use client";

import { relativeDay } from "@/domain/documents/archive-views";
import { isSummaryStale } from "@/domain/ai/dossier-summary";
import type { DossierSummary } from "@/domain/dossiers/types";
import { SMALL_BUTTON } from "@/components/dossiers/styles";

/**
 * "In breve": il riassunto della vicenda scritto da Hinthia leggendo le sintesi dei documenti che ha già letto. Si scrive
 * solo quando lo chiedi, e solo con i documenti che hai permesso di far leggere a Hinthia.
 */
export function DossierSummaryCard({
  summary,
  readable,
  canWrite,
  busy,
  notice,
  now,
  onWrite,
  onRemove,
}: {
  summary: DossierSummary | null;
  /** Quanti documenti del fascicolo Hinthia ha già letto. */
  readable: number;
  /** Hinthia attiva e consenso all'estrazione dati: senza, il riassunto non si può scrivere. */
  canWrite: boolean;
  busy: boolean;
  /** Un'avvertenza dell'ultima richiesta ("2 documenti sono rimasti fuori"). */
  notice: string | null;
  now: Date;
  onWrite: () => void;
  onRemove: () => void;
}) {
  const stale = summary ? isSummaryStale(summary, readable) : false;

  return (
    <section
      aria-label="In breve"
      className="flex flex-col gap-3 rounded-[18px] border border-[#cdd8fa] bg-[#f3f6ff] px-5 py-4 dark:border-brand/40 dark:bg-brand/10"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white dark:bg-zinc-950" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2b4fc4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" />
          </svg>
        </span>
        <h2 className="font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100">In breve</h2>
      </div>

      {summary ? (
        <>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap text-[#2c3557] dark:text-zinc-200">{summary.text}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs text-[#5b6483] dark:text-zinc-400">
              Scritto da Hinthia {relativeDay(summary.generatedAt, now)} · letto da {summary.documentCount}{" "}
              {summary.documentCount === 1 ? "documento" : "documenti"}
            </span>
            {canWrite ? (
              <button type="button" disabled={busy} onClick={onWrite} className={SMALL_BUTTON}>
                {busy ? "Scrivo…" : "Aggiorna"}
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={onRemove} className="text-xs font-bold text-[#8a91ad] hover:text-red-600 disabled:opacity-50">
              Elimina il riassunto
            </button>
          </div>
          {stale ? (
            <p className="text-xs font-bold text-[#8a5a00]">
              Hinthia ha letto altri documenti dopo questo riassunto: aggiornalo per includerli.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-[13.5px] leading-snug text-[#3d4670] dark:text-zinc-300">
            Hinthia può riassumere questa vicenda in poche righe, partendo da ciò che ha già letto dei tuoi documenti ({readable}{" "}
            {readable === 1 ? "letto" : "letti"}). Le sintesi vengono inviate a Claude solo ora, e solo quelle dei documenti che hai
            abilitato.
          </p>
          <button type="button" disabled={busy || !canWrite} onClick={onWrite} className={`${SMALL_BUTTON} self-start`}>
            {busy ? "Scrivo…" : "Scrivi il riassunto"}
          </button>
        </>
      )}
      {notice ? <p className="text-xs text-[#5b6483] dark:text-zinc-400">{notice}</p> : null}
    </section>
  );
}
