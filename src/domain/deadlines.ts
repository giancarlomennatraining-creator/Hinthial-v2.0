import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * Le scadenze, in un solo elenco. In Hinthial una scadenza nasce in due modi: la crei tu come tale (una "scadenza", tabella
 * dei promemoria) o è la data di scadenza scritta sulla scheda di un documento. Oggi, il bene, il fascicolo e la scheda
 * Scadenze le riuniscono qui, con le stesse regole, invece di ognuno per conto suo. Puro: nessuna rete, nessun database.
 */
export interface Deadline {
  /** "reminder" = una scadenza creata; "document" = la data di scadenza scritta sul documento. */
  kind: "reminder" | "document";
  id: string;
  title: string;
  /** ISO: un istante per una scadenza, una data (`YYYY-MM-DD`) per un documento. */
  date: string;
}

type DeadlineDocument = Pick<DocumentSummary, "id" | "filename" | "expiresAt">;
type DeadlineReminder = Pick<ReminderListItem, "id" | "title" | "dueAt" | "completed" | "relatedDocumentId">;

const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Le date di scadenza dei documenti che non sono già una scadenza creata: se un documento ha una scadenza dello stesso
 * giorno (succede con un pagamento accettato come evento da Hinthia), conta solo quella, che ha un titolo più chiaro.
 * Anche una già completata la copre: la data è stata gestita.
 */
export function uncoveredExpiries<D extends Pick<DocumentSummary, "id" | "expiresAt">>(
  documents: D[],
  reminders: Pick<ReminderListItem, "dueAt" | "relatedDocumentId">[],
): D[] {
  const covered = new Set(
    reminders.filter((r) => r.relatedDocumentId !== null).map((r) => `${r.relatedDocumentId}:${dayOf(r.dueAt)}`),
  );
  return documents.filter((d) => d.expiresAt && !covered.has(`${d.id}:${dayOf(d.expiresAt)}`));
}

/**
 * Le scadenze ancora aperte, dalla più vicina: quelle create (non completate) e le date di scadenza dei documenti. Chi
 * chiama passa già solo ciò che gli interessa (i documenti di un bene, di un fascicolo, quelli in scadenza a breve).
 */
export function mergeDeadlines(documents: DeadlineDocument[], reminders: DeadlineReminder[]): Deadline[] {
  const fromReminders: Deadline[] = reminders
    .filter((r) => !r.completed)
    .map((r) => ({ kind: "reminder", id: r.id, title: r.title, date: r.dueAt }));

  const fromDocuments: Deadline[] = uncoveredExpiries(documents, reminders).map((d) => ({
    kind: "document",
    id: d.id,
    title: `${d.filename} scade`,
    date: d.expiresAt as string,
  }));

  return [...fromReminders, ...fromDocuments].sort((a, b) => a.date.localeCompare(b.date));
}
