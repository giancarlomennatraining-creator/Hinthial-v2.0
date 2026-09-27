/** Cestino: calcoli puri di data, separati da moveDocumentsToTrash per poterli testare senza un database vero. */

/** Calcolato una volta al momento dello spostamento --- cambiare poi il periodo di conservazione non sposta retroattivamente questa data. */
export function computePurgeAt(deletedAt: Date, retentionDays: number): Date {
  return new Date(deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

/** Giorni interi rimanenti, mai negativo; arrotondato per eccesso (6 ore restanti = ancora "1 giorno"). */
export function daysRemaining(purgeAt: Date, now: Date = new Date()): number {
  const ms = purgeAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
