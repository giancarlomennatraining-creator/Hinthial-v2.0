import type { ReminderListItem } from "@/domain/reminders/types";

/** Quanto è urgente una scadenza: scaduta, entro una settimana, entro un mese, più in là. */
export type DeadlineLevel = "over" | "danger" | "warn" | "soft";

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Giorni di calendario (nel fuso dell'utente) da `now` a `iso`: 0 = oggi, negativo = già passata. */
export function daysUntil(iso: string, now: Date): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
}

export function deadlineLevel(days: number): DeadlineLevel {
  if (days < 0) return "over";
  if (days <= 7) return "danger";
  if (days <= 30) return "warn";
  return "soft";
}

/** "scaduta da 9 giorni", "oggi", "domani", "tra 5 giorni", "tra 2 mesi". */
export function whenText(days: number): string {
  if (days < 0) return days === -1 ? "scaduta ieri" : `scaduta da ${-days} giorni`;
  if (days === 0) return "oggi";
  if (days === 1) return "domani";
  if (days <= 30) return `tra ${days} giorni`;
  const months = Math.round(days / 30);
  return months === 1 ? "tra 1 mese" : `tra ${months} mesi`;
}

/** Da quanto è stato aggiunto qualcosa: "oggi", "ieri", "3 giorni fa", poi la data ("12 set 2026"). */
export function agoText(iso: string, now: Date): string {
  const days = -daysUntil(iso, now);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days <= 6) return `${days} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** `iso` spostato avanti di `n` giorni, alla stessa ora (la data di una scadenza resta tale anche passando l'ora legale). */
export function addDaysIso(iso: string, n: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + n);
  return date.toISOString();
}

interface WeekDay {
  /** Il giorno di calendario, nel fuso dell'utente (`YYYY-MM-DD`). */
  key: string;
  /** Il primo istante di quel giorno: serve a etichettarlo (lun, mar...). */
  date: Date;
  /** Le scadenze aperte di quel giorno, in ordine d'orario. */
  items: ReminderListItem[];
  isToday: boolean;
}

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface TodayPlan {
  /** Da fare ora: tutto ciò che è già scaduto o scade entro 7 giorni, il più urgente per primo. */
  actions: ReminderListItem[];
  /** Le prossime tre dopo la settimana. */
  later: ReminderListItem[];
  /** I sette giorni da oggi, con le scadenze di ciascuno. */
  week: WeekDay[];
}

/** Ordina e divide le scadenze aperte per la dashboard "Oggi". */
export function buildTodayPlan(reminders: ReminderListItem[], now: Date): TodayPlan {
  const open = reminders
    .filter((r) => !r.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const actions = open.filter((r) => daysUntil(r.dueAt, now) <= 7);
  const later = open.filter((r) => daysUntil(r.dueAt, now) > 7).slice(0, 3);

  const week: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = dayKey(date);
    week.push({
      key,
      date,
      isToday: i === 0,
      items: open.filter((r) => dayKey(new Date(r.dueAt)) === key),
    });
  }

  return { actions, later, week };
}
