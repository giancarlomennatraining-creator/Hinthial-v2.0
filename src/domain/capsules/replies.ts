/**
 * "Lascia un pensiero": le due righe che chi riceve una capsula, una volta aperta, può scrivere a chi l'ha lasciata. Il
 * pensiero viaggia cifrato per la chiave pubblica del proprietario (v. replies-repository.ts): qui, la parte pura.
 */

/** Quanto può essere lungo un pensiero: due righe, non una seconda lettera. */
export const MAX_REPLY_LENGTH = 600;

/** Ciò che sta dentro il pensiero cifrato: solo il proprietario lo legge. */
export interface ReplyPayload {
  authorName: string;
  message: string;
  /** ISO. */
  writtenAt: string;
}

/** Il testo da inviare, ripulito dagli spazi; null se è vuoto o troppo lungo. */
export function normalizeReply(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.length > MAX_REPLY_LENGTH) return null;
  return trimmed;
}

/** Il contenuto decifrato di un pensiero, o null se non ha la forma giusta (un dato corrotto non deve rompere l'elenco). */
export function parseReplyPayload(raw: unknown): ReplyPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { authorName, message, writtenAt } = raw as Record<string, unknown>;
  if (typeof authorName !== "string" || typeof message !== "string" || typeof writtenAt !== "string") return null;
  if (message.trim() === "") return null;
  return { authorName, message, writtenAt };
}

/** Come si dice quanti pensieri ha una capsula. */
export function repliesLabel(count: number): string {
  return count === 1 ? "1 pensiero" : `${count} pensieri`;
}
