/**
 * Cestino --- calcoli puri di data, separati da moveDocumentsToTrash
 * (domain/documents/repository.ts, la parte che scrive) per poterli
 * testare senza un database vero.
 */

/**
 * Quando un documento spostato nel cestino oggi verrà eliminato per
 * sempre --- calcolato una volta al momento dello spostamento (v.
 * commento sulla colonna purge_at nella migrazione 20260923000000):
 * cambiare il periodo di conservazione più avanti non deve spostare
 * retroattivamente questa data.
 */
export function computePurgeAt(deletedAt: Date, retentionDays: number): Date {
  return new Date(deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Giorni interi rimanenti prima della purga --- mai negativo (un
 * documento già scaduto ma non ancora passato dal cron mostra 0, non
 * un numero negativo che sembrerebbe un errore). Arrotondato per
 * eccesso: se mancano 6 ore, sono ancora "1 giorno", non "0".
 */
export function daysRemaining(purgeAt: Date, now: Date = new Date()): number {
  const ms = purgeAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
