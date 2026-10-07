import type { ReminderListItem } from "@/domain/reminders/types";
import { daysUntil } from "@/domain/dashboard/deadlines";

/** Le colonne della Lavagna: per quanto manca, più "Fatte". */
export type BoardColumn = "over" | "week" | "month" | "later" | "done";

export const BOARD_COLUMNS: { key: BoardColumn; label: string }[] = [
  { key: "over", label: "Da sistemare" },
  { key: "week", label: "Questa settimana" },
  { key: "month", label: "Questo mese" },
  { key: "later", label: "Più avanti" },
  { key: "done", label: "Fatte" },
];

/** Quante scadenze completate mostrare in "Fatte": sono lì per poterne riaprire una, non per tenere lo storico. */
export const BOARD_DONE_LIMIT = 5;

/**
 * Quando una carta cambia colonna la sua data si sposta a un giorno di quella colonna, a metà circa: tra 4 giorni per
 * "Questa settimana", tra 20 per "Questo mese", tra 60 per "Più avanti". L'ora resta quella di prima.
 */
const TARGET_OFFSET_DAYS: Record<"week" | "month" | "later", number> = { week: 4, month: 20, later: 60 };

/** In quale colonna sta una scadenza: completata = "Fatte", altrimenti per giorni mancanti (scaduta, entro 7, entro 30, oltre). */
export function columnOf(reminder: ReminderListItem, now: Date): BoardColumn {
  if (reminder.completed) return "done";
  const days = daysUntil(reminder.dueAt, now);
  if (days < 0) return "over";
  if (days <= 7) return "week";
  if (days <= 30) return "month";
  return "later";
}

/** Le scadenze divise per colonna, in ordine di data; "Fatte" ha solo le ultime `BOARD_DONE_LIMIT`, le più recenti per prime. */
export function buildBoard(reminders: ReminderListItem[], now: Date): Record<BoardColumn, ReminderListItem[]> {
  const columns: Record<BoardColumn, ReminderListItem[]> = { over: [], week: [], month: [], later: [], done: [] };
  const sorted = [...reminders].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  for (const reminder of sorted) columns[columnOf(reminder, now)].push(reminder);
  columns.done = columns.done.reverse().slice(0, BOARD_DONE_LIMIT);
  return columns;
}

export type BoardMove =
  /** Niente da fare: la carta è già lì. */
  | { kind: "none" }
  /** Non si può: "Da sistemare" si riempie da sola con il passare del tempo, non ci si sposta a mano. */
  | { kind: "refused"; reason: string }
  | {
      kind: "move";
      /** Il nuovo stato di "completata". */
      completed: boolean;
      /** La nuova data (ISO), o null se resta quella di prima. */
      dueAt: string | null;
    };

/** Cosa succede se la carta viene rilasciata nella colonna `target`: tutto quello che serve a salvare, e niente più. */
export function planMove(reminder: ReminderListItem, target: BoardColumn, now: Date): BoardMove {
  const current = columnOf(reminder, now);
  if (current === target) return { kind: "none" };

  if (target === "over") {
    return { kind: "refused", reason: "Non si può rimandare indietro nel tempo: da sistemare diventa ciò che è già scaduto." };
  }
  if (target === "done") return { kind: "move", completed: true, dueAt: null };

  // Verso una colonna di date: una carta "Fatta" torna aperta; la data si sposta solo se serve.
  const offset = TARGET_OFFSET_DAYS[target];
  const date = new Date(reminder.dueAt);
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, date.getHours(), date.getMinutes());
  const alreadyInside = columnOf({ ...reminder, completed: false }, now) === target;
  return { kind: "move", completed: false, dueAt: alreadyInside ? null : base.toISOString() };
}
