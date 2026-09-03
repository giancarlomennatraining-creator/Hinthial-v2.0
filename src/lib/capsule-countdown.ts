/**
 * Pure countdown math for a capsule with an opening date (v.
 * components/capsules/CapsuleCountdown.tsx) --- kept separate so it's
 * testable without a clock mock inside a React component. Purely
 * informational: no automatic opening happens at openAt (v.
 * domain/capsules/types.ts, CapsuleListItem.openAt).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CountdownInfo {
  /** Whole days from now to openAt --- negative once the date has passed. */
  daysUntil: number;
  /** 0-100, clamped --- how far along "now" is between createdAt and openAt. */
  progressPercent: number;
  label: string;
}

/** Midnight (local time) of the given date --- openAt is a date, not a timestamp (v. domain/capsules/types.ts), so "days until" must compare calendar dates, not raw 24h spans. */
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

  const totalSpan = open - created;
  const elapsed = current - created;
  const progressPercent = totalSpan > 0 ? Math.min(100, Math.max(0, (elapsed / totalSpan) * 100)) : 100;

  let label: string;
  if (daysUntil > 1) label = `Si aprirà tra ${daysUntil} giorni`;
  else if (daysUntil === 1) label = "Si aprirà domani";
  else if (daysUntil === 0) label = "Si apre oggi";
  else if (daysUntil === -1) label = "Data di apertura superata da 1 giorno";
  else label = `Data di apertura superata da ${Math.abs(daysUntil)} giorni`;

  return { daysUntil, progressPercent, label };
}
