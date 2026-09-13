/**
 * Pure countdown math for a capsule con-una data di apertura (v.
 * components/capsules/CapsuleCountdown.tsx) --- kept separate so it's
 * testable without a clock mock inside a React component. Purely
 * informational: no automatic opening happens at openAt (v.
 * domain/capsules/types.ts, CapsuleListItem.openAt). Mostrato solo per
 * le capsule non più in bozza (v. CapsulesPanel.tsx) --- su una bozza
 * openAt può ancora cambiare, quindi un conto alla rovescia non avrebbe
 * senso.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface CountdownInfo {
  /** Whole days from now to openAt --- negative once the date has passed. */
  daysUntil: number;
  /** 0-100, clamped --- how far along "now" is between createdAt and openAt. */
  progressPercent: number;
  label: string;
}

/** Midnight (local time) of the given date --- usato solo per capire se openAt cade "oggi"/"domani" a fini di etichetta; il calcolo delle ore/minuti restanti (sotto la soglia di 1 giorno) usa invece la differenza esatta in millisecondi, non le date di calendario. */
function dateOnly(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function computeCountdown(
  createdAt: string,
  openAt: string,
  now: Date = new Date(),
): CountdownInfo {
  const created = new Date(createdAt).getTime();
  const open = new Date(openAt).getTime();
  const current = now.getTime();

  const daysUntil = Math.round((dateOnly(new Date(openAt)) - dateOnly(now)) / DAY_MS);
  const msUntil = open - current;

  const totalSpan = open - created;
  const elapsed = current - created;
  const progressPercent = totalSpan > 0 ? Math.min(100, Math.max(0, (elapsed / totalSpan) * 100)) : 100;

  let label: string;
  if (msUntil <= 0) {
    label = daysUntil === -1 ? "Data di apertura superata da 1 giorno" : `Data di apertura superata da ${Math.abs(daysUntil)} giorni`;
  } else if (msUntil < HOUR_MS) {
    // Clamp a 59: un arrotondamento vicino al bordo dell'ora (es. 59.6 min) non deve mostrare "60 minuti".
    const minutesUntil = Math.min(59, Math.max(1, Math.round(msUntil / MINUTE_MS)));
    label = minutesUntil === 1 ? "Si aprirà tra 1 minuto" : `Si aprirà tra ${minutesUntil} minuti`;
  } else if (msUntil < DAY_MS) {
    // Stesso discorso al bordo del giorno (es. 23.6 h non deve mostrare "24 ore").
    const hoursUntil = Math.min(23, Math.round(msUntil / HOUR_MS));
    label = hoursUntil === 1 ? "Si aprirà tra 1 ora" : `Si aprirà tra ${hoursUntil} ore`;
  } else if (daysUntil === 1) label = "Si aprirà domani";
  else label = `Si aprirà tra ${daysUntil} giorni`;

  return { daysUntil, progressPercent, label };
}
