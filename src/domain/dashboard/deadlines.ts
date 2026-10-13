const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Giorni di calendario (nel fuso dell'utente) da `now` a `iso`: 0 = oggi, negativo = già passata. */
export function daysUntil(iso: string, now: Date): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
}

/** Da quanto è stato aggiunto qualcosa: "oggi", "ieri", "3 giorni fa", poi la data ("12 set 2026"). */
export function agoText(iso: string, now: Date): string {
  const days = -daysUntil(iso, now);
  if (days <= 0) return "oggi";
  if (days === 1) return "ieri";
  if (days <= 6) return `${days} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
