/**
 * I documenti appena importati che aspettano ancora una conferma (v. ConfirmImport): si ricordano su questo dispositivo, per
 * poter riaprire la schermata di conferma da Archivio se la si chiude a metà. Sono solo gli identificativi, per utente:
 * nessun contenuto, e nessun dato sul server. Una memoria che non si legge (finestra privata, dati del sito bloccati) non
 * rompe nulla: semplicemente non c'è il promemoria.
 */

const KEY_PREFIX = "hinthial:pending-confirmation:";

/** Un lotto non resta in sospeso per sempre: oltre questi giorni il promemoria si lascia cadere. */
const MAX_AGE_DAYS = 30;

interface Entry {
  id: string;
  at: number;
}

function read(userId: string): Entry[] {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const oldest = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return parsed.filter(
      (entry): entry is Entry => typeof entry?.id === "string" && typeof entry?.at === "number" && entry.at >= oldest,
    );
  } catch {
    return [];
  }
}

function write(userId: string, entries: Entry[]): void {
  try {
    if (entries.length === 0) window.localStorage.removeItem(KEY_PREFIX + userId);
    else window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(entries));
  } catch {
    // Solo un promemoria: se non si può salvare, si perde il promemoria e nient'altro.
  }
}

/** Gli identificativi dei documenti in attesa di conferma, dal più vecchio. */
export function loadPendingConfirmation(userId: string): string[] {
  return read(userId).map((entry) => entry.id);
}

/** Aggiunge dei documenti a quelli in attesa (senza ripeterli). */
export function addPendingConfirmation(userId: string, ids: string[]): void {
  const entries = read(userId);
  const known = new Set(entries.map((entry) => entry.id));
  const now = Date.now();
  write(userId, [...entries, ...ids.filter((id) => !known.has(id)).map((id) => ({ id, at: now }))]);
}

/** Toglie dei documenti da quelli in attesa: confermati, o lasciati stare. */
export function removePendingConfirmation(userId: string, ids: string[]): void {
  const gone = new Set(ids);
  write(
    userId,
    read(userId).filter((entry) => !gone.has(entry.id)),
  );
}
