"use client";

import Link from "next/link";
import { formatDayMonthYear } from "@/domain/documents/archive-views";
import { formatEuro, type DossierDeadline, type DossierExpenses } from "@/domain/dossiers/overview";
import type { DocumentCandidate } from "@/domain/dossiers/suggestions";
import type { DocumentListItem } from "@/domain/documents/types";
import { CARD, CARD_TITLE, SMALL_BUTTON } from "@/components/dossiers/styles";

const LEVEL_COLOR = { overdue: "#b42318", danger: "#b42318", warn: "#8a5a00", soft: "#5b6483", none: "#5b6483" } as const;
const EXPENSE_COLORS = ["#2b4fc4", "#6f8ae0", "#0f8b8d", "#e0a73a", "#c9d0e6"];

/** Altri documenti dello stesso bene dei documenti del fascicolo, ancora fuori: si aggiungono con un clic o si scartano. */
export function CandidatesCard({
  candidates,
  busy,
  onAdd,
  onDismiss,
}: {
  candidates: DocumentCandidate[];
  busy: boolean;
  onAdd: (documentId: string) => void;
  onDismiss: (documentId: string) => void;
}) {
  return (
    <section aria-label="Forse appartengono qui" className={CARD}>
      <h2 className={CARD_TITLE}>Forse appartengono qui</h2>
      <p className="text-[13px] leading-snug text-[#5b6483] dark:text-zinc-400">
        Altri documenti di &laquo;{candidates[0].assetName}&raquo;, come quelli di questo fascicolo.
      </p>
      <ul className="flex flex-col">
        {candidates.map((candidate) => (
          <li key={candidate.documentId} className="flex items-center gap-2 border-t border-[#eef0f8] py-2 first:border-t-0 first:pt-0 dark:border-zinc-900">
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/archive/${candidate.documentId}`} className="truncate text-[13px] font-bold hover:text-brand">
                {candidate.filename}
              </Link>
              <span className="text-xs text-[#5b6483] dark:text-zinc-400">{formatDayMonthYear(candidate.createdAt)}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdd(candidate.documentId)}
              aria-label={`Aggiungi ${candidate.filename} al fascicolo`}
              className="shrink-0 rounded-lg border border-[#c9d0e6] bg-white px-2.5 py-1 text-xs font-bold text-brand hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
            >
              Aggiungi
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDismiss(candidate.documentId)}
              aria-label={`Non aggiungere ${candidate.filename}`}
              className="shrink-0 rounded-md px-1.5 text-base leading-none text-[#8a91ad] hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DeadlinesCard({ deadlines }: { deadlines: DossierDeadline[] }) {
  return (
    <section aria-label="Prossime scadenze" className={CARD}>
      <h2 className={CARD_TITLE}>Prossime scadenze</h2>
      <ul className="flex flex-col">
        {deadlines.slice(0, 5).map((deadline) => (
          <li key={`${deadline.kind}-${deadline.id}`} className="flex flex-col gap-0.5 border-t border-[#eef0f8] py-2.5 first:border-t-0 first:pt-0 dark:border-zinc-900">
            <span className="text-sm leading-snug font-semibold">{deadline.title}</span>
            <span className="text-xs font-bold" style={{ color: LEVEL_COLOR[deadline.info.level] }}>
              {formatDayMonthYear(deadline.date)} · {deadline.info.text.replace("scade ", "")}
            </span>
          </li>
        ))}
      </ul>
      {deadlines.length > 5 ? <p className="text-xs text-[#5b6483] dark:text-zinc-400">e altre {deadlines.length - 5}</p> : null}
    </section>
  );
}

export function ExpensesCard({ expenses }: { expenses: DossierExpenses }) {
  const slices = [
    ...expenses.items.slice(0, 4),
    ...(expenses.items.length > 4
      ? [{ docId: "rest", filename: "Altro", label: "", amount: expenses.items.slice(4).reduce((sum, item) => sum + item.amount, 0) }]
      : []),
  ];

  return (
    <section aria-label="Spese" className={CARD}>
      <div className="flex items-baseline justify-between">
        <h2 className={CARD_TITLE}>Spese</h2>
        <span className="font-heading text-xl font-extrabold text-brand">{formatEuro(expenses.total)}</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]" aria-hidden="true">
        {slices.map((slice, i) => (
          <span key={slice.docId} style={{ flex: slice.amount, background: EXPENSE_COLORS[i] }} />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5">
        {slices.map((slice, i) => (
          <li key={slice.docId} className="flex items-center gap-2 text-[13px]">
            <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: EXPENSE_COLORS[i] }} />
            <span className="min-w-0 flex-1 truncate text-[#3d4670] dark:text-zinc-300">{slice.filename.replace(/\.[a-z0-9]{2,5}$/i, "")}</span>
            <span className="font-bold">{formatEuro(slice.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">Le cifre vengono dagli importi letti nei documenti del fascicolo.</p>
    </section>
  );
}

/** Le sintesi che Hinthia ha già scritto sui documenti letti: si leggono solo al clic, nessuna nuova lettura parte. */
export function ReadingsCard({
  readings,
  busy,
  onShow,
}: {
  readings: DocumentListItem[] | null;
  busy: boolean;
  onShow: () => void;
}) {
  return (
    <section aria-label="Cosa dicono i documenti" className={CARD}>
      <h2 className={CARD_TITLE}>Cosa dicono i documenti</h2>
      {readings === null ? (
        <>
          <p className="text-[13px] leading-snug text-[#5b6483] dark:text-zinc-400">
            Le sintesi che Hinthia ha già scritto leggendo i documenti: nessuna nuova lettura parte.
          </p>
          <button type="button" disabled={busy} onClick={onShow} className={`${SMALL_BUTTON} self-start`}>
            {busy ? "Leggo…" : "Mostra le sintesi"}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-[#5b6483] dark:text-zinc-400">
            {readings.filter((d) => d.aiSynthesis).length} di {readings.length} documenti letti da Hinthia
          </p>
          <ul className="flex flex-col gap-3">
            {readings
              .filter((d) => d.aiSynthesis)
              .map((d) => (
                <li key={d.id} className="flex flex-col gap-0.5">
                  <Link href={`/archive/${d.id}`} className="truncate text-[13px] font-bold hover:text-brand">
                    {d.filename}
                  </Link>
                  <span className="line-clamp-4 text-[13px] leading-snug text-[#3d4670] dark:text-zinc-300">{d.aiSynthesis}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  );
}
