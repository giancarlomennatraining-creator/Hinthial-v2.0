import { formatDate } from "@/lib/format";

/**
 * Le date da ricordare che Hinthia ha trovato ma che sono già passate: non si propongono (un promemoria nel passato non
 * serve), e per non farle sparire in silenzio si dice cosa è successo. Se servono, si crea la scadenza a mano.
 */
export function PastEventsNotice({ events }: { events: { date: string; title: string }[] }) {
  if (events.length === 0) return null;

  return (
    <aside
      aria-label="Date già passate"
      className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      <p>
        {events.length === 1
          ? "Hinthia ha trovato una data da ricordare, ma è già passata: non l'ho aggiunta a Scadenze."
          : "Hinthia ha trovato alcune date da ricordare, ma sono già passate: non le ho aggiunte a Scadenze."}
      </p>
      <ul className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
        {events.map((event) => (
          <li key={event.date}>
            {formatDate(event.date)} &mdash; {event.title}
          </li>
        ))}
      </ul>
    </aside>
  );
}
