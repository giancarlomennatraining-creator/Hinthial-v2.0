"use client";

import Link from "next/link";
import { formatDayMonthYear } from "@/domain/documents/archive-views";
import { formatEuro, type LivingTimelineEntry, type TimelineKind } from "@/domain/dossiers/overview";
import { CARD_TITLE } from "@/components/dossiers/styles";

const ENTRY_STYLE: Record<TimelineKind, { bg: string; fg: string; icon: string }> = {
  document: { bg: "#e8edfc", fg: "#2b4fc4", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z M14 3v5h5" },
  note: { bg: "#fdf3dd", fg: "#8a5a00", icon: "M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
  event: {
    bg: "#e3f4ec",
    fg: "#1c7c5a",
    icon: "M8 2v4 M16 2v4 M3 10h18 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  },
};

function TimelineRow({ entry }: { entry: LivingTimelineEntry }) {
  const style = ENTRY_STYLE[entry.kind];
  const title =
    entry.documentId !== null ? (
      <Link href={`/archive/${entry.documentId}`} className="text-[14.5px] font-bold break-words text-[#121a35] hover:text-brand dark:text-zinc-100">
        {entry.title}
      </Link>
    ) : (
      <span className="text-[14.5px] font-bold break-words text-[#121a35] dark:text-zinc-100">{entry.title}</span>
    );

  return (
    <li className="relative grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-x-3.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[#f6f8ff] sm:grid-cols-[88px_minmax(0,1fr)_auto] dark:hover:bg-zinc-900">
      <span
        className="absolute top-1/2 -left-[43px] -mt-3.5 box-content flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white dark:border-zinc-950"
        style={{ background: style.bg }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.fg} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={style.icon} />
        </svg>
      </span>
      <span className="text-[12.5px] font-bold text-[#5b6483] dark:text-zinc-400" title={entry.kind === "document" || entry.kind === "note" ? "Data di caricamento" : "Data della scadenza"}>
        {formatDayMonthYear(entry.date)}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {title}
        {entry.detail ? <span className="text-[12.5px] text-[#5b6483] dark:text-zinc-400">{entry.detail}</span> : null}
      </span>
      {entry.expense !== null ? (
        <span className="rounded-full bg-[#e0f2f2] px-[11px] py-1 text-xs font-extrabold whitespace-nowrap text-[#0b6e70]">{formatEuro(entry.expense)}</span>
      ) : entry.completed ? (
        <span className="rounded-full bg-[#e3f4ec] px-[11px] py-1 text-xs font-extrabold text-[#1c7c5a]">Fatto</span>
      ) : null}
    </li>
  );
}

/** La cronologia viva del fascicolo, con il campo per scrivere una nota (che diventa una nota dell'Archivio collegata). */
export function DossierTimeline({
  timeline,
  noteText,
  noteBusy,
  onNoteChange,
  onAddNote,
}: {
  timeline: LivingTimelineEntry[];
  noteText: string;
  noteBusy: boolean;
  onNoteChange: (text: string) => void;
  onAddNote: () => void;
}) {
  return (
    <section
      aria-label="Cronologia"
      className="flex min-w-0 flex-col gap-3.5 rounded-[18px] border border-[#dfe3f0] bg-white px-5 py-[18px] dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className={CARD_TITLE}>Cronologia</h2>

      <div className="flex gap-2">
        <input
          type="text"
          value={noteText}
          onChange={(e) => onNoteChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAddNote();
          }}
          placeholder="Scrivi una nota…"
          aria-label="Scrivi una nota"
          className="min-w-0 flex-1 rounded-xl border-[1.5px] border-[#dfe3f0] bg-white px-3.5 py-2.5 text-sm text-[#121a35] outline-none focus:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
        />
        <button
          type="button"
          disabled={noteBusy || !noteText.trim()}
          onClick={onAddNote}
          className="rounded-xl bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Aggiungi nota
        </button>
      </div>

      {timeline.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nessun documento collegato. Aprine uno in Archivio e scegli questo fascicolo dal campo &laquo;Fascicolo&raquo;.
        </p>
      ) : (
        <ul className="ml-[17px] flex flex-col border-l-2 border-[#dfe3f0] pl-6 dark:border-zinc-800">
          {timeline.map((entry) => (
            <TimelineRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
