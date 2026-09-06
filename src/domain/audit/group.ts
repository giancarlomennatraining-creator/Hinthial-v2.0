import type { AuditEventListItem } from "@/domain/audit/types";

export interface AuditEventGroup {
  /** "Oggi", "Ieri", o una data localizzata (es. "3 settembre 2026"). */
  label: string;
  events: AuditEventListItem[];
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Raggruppa per giorno di calendario (ora locale), più recente prima ---
 * stesso principio di groupTimelineByMonth (lib/timeline.ts) ma per
 * giorno, con "Oggi"/"Ieri" al posto della data quando applicabile.
 * `now` è iniettabile per i test, di default il momento reale.
 */
export function groupAuditEventsByDay(
  events: AuditEventListItem[],
  now: Date = new Date(),
): AuditEventGroup[] {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const groups = new Map<number, AuditEventListItem[]>();
  for (const event of events) {
    const day = startOfDay(new Date(event.createdAt));
    const group = groups.get(day);
    if (group) group.push(event);
    else groups.set(day, [event]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([day, dayEvents]) => ({
      label:
        day === todayStart
          ? "Oggi"
          : day === yesterdayStart
            ? "Ieri"
            : capitalize(
                new Date(day).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              ),
      events: dayEvents,
    }));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
