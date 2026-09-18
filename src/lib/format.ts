/**
 * Formattazioni condivise tra l'elenco dell'Archivio e la scheda di un
 * singolo contenuto (FASE 17e) --- erano due copie della stessa
 * funzione, e due copie divergono sempre.
 */

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Importo in euro, nella forma italiana --- v. FASE 18. */
export function formatAmount(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
