import { expiryInfo, type ExpiryInfo } from "@/domain/documents/archive-views";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import type { DossierStep } from "@/domain/dossiers/items";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

/**
 * Un fascicolo "vivo": quello che si capisce di una vicenda guardando i suoi documenti, senza che nessuno debba compilare
 * niente. Prossima scadenza, spese, beni coinvolti e cronologia si ricavano da ciò che c'è già (le scadenze collegate ai
 * documenti, gli importi letti da Hinthia, i beni collegati). Puro: nessuna rete, nessun database.
 */

// ---------------------------------------------------------------------------------------------------------------
// Importi
// ---------------------------------------------------------------------------------------------------------------

/**
 * I campi che dicono quanto è costato qualcosa, dal più preciso al più generico. Altri importi (massimale, saldo di un
 * conto) non sono spese: contarli darebbe un totale falso.
 */
const EXPENSE_FIELDS: { key: string; label: string }[] = [
  { key: "importo_totale", label: "Importo" },
  { key: "importo_sanzione", label: "Sanzione" },
  { key: "premio", label: "Premio" },
  { key: "importo", label: "Importo" },
];

const CURRENCY = /€|\b(?:euro|eur)\b/gi;

/** "EUR 612,40", "€ 1.240,00", "1240.50", "612,40 €" → un numero; altro → null. Mai zero o negativo. */
export function parseAmount(raw: string): number | null {
  const text = raw.replace(CURRENCY, " ").replace(/\s+/g, "").trim();
  if (!/^\d[\d.,]*$/.test(text)) return null;

  let normalized: string;
  if (text.includes(",") && text.includes(".")) {
    // Il separatore che compare per ultimo è quello dei decimali.
    normalized =
      text.lastIndexOf(",") > text.lastIndexOf(".") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    normalized = text.replace(",", ".");
  } else if (text.includes(".")) {
    // "1.240" sono mille duecentoquaranta; "12.50" sono dodici e cinquanta.
    normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
  } else {
    normalized = text;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export interface DocumentExpense {
  amount: number;
  label: string;
}

export function documentExpense(doc: Pick<DocumentSummary, "structuredFields">): DocumentExpense | null {
  for (const field of EXPENSE_FIELDS) {
    const raw = doc.structuredFields[field.key];
    if (!raw) continue;
    const amount = parseAmount(raw);
    if (amount !== null) return { amount, label: field.label };
  }
  return null;
}

/** "€ 1.240" per un importo tondo, "€ 612,40" altrimenti: sempre con il punto alle migliaia, in qualunque ambiente. */
export function formatEuro(amount: number): string {
  const cents = Math.round(amount * 100);
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return rest === 0 ? `€ ${grouped}` : `€ ${grouped},${String(rest).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Scadenze
// ---------------------------------------------------------------------------------------------------------------

export interface DossierDeadline {
  kind: "reminder" | "document" | "step";
  id: string;
  title: string;
  /** ISO: un istante per una scadenza, una data per un documento. */
  date: string;
  info: ExpiryInfo;
}

/**
 * Le scadenze del fascicolo, dalla più urgente (le già scadute per prime): quelle create per i suoi documenti e la data
 * di scadenza dei documenti stessi, più i prossimi passi con una data. Se la data di un documento è già una scadenza dello
 * stesso giorno, resta solo questa, che ha un titolo più chiaro. Le completate e i passi fatti non contano.
 */
export function dossierDeadlines(
  documents: Pick<DocumentSummary, "id" | "filename" | "expiresAt">[],
  reminders: Pick<ReminderListItem, "id" | "title" | "dueAt" | "completed" | "relatedDocumentId">[],
  now: Date,
  steps: Pick<DossierStep, "id" | "text" | "dueOn" | "done">[] = [],
): DossierDeadline[] {
  const documentIds = new Set(documents.map((d) => d.id));
  const mine = reminders.filter((r) => r.relatedDocumentId !== null && documentIds.has(r.relatedDocumentId));
  const dayOf = (iso: string) => iso.slice(0, 10);
  const covered = new Set(mine.map((r) => `${r.relatedDocumentId}:${dayOf(r.dueAt)}`));

  const fromReminders: DossierDeadline[] = mine
    .filter((r) => !r.completed)
    .map((r) => ({ kind: "reminder", id: r.id, title: r.title, date: r.dueAt, info: expiryInfo(r.dueAt.slice(0, 10), now) }));

  const fromDocuments: DossierDeadline[] = documents
    .filter((d) => d.expiresAt && !covered.has(`${d.id}:${dayOf(d.expiresAt)}`))
    .map((d) => ({
      kind: "document",
      id: d.id,
      title: `${d.filename} scade`,
      date: d.expiresAt as string,
      info: expiryInfo(d.expiresAt, now),
    }));

  const fromSteps: DossierDeadline[] = steps
    .filter((s) => !s.done && s.dueOn)
    .map((s) => ({ kind: "step", id: s.id, title: s.text, date: s.dueOn as string, info: expiryInfo(s.dueOn, now) }));

  return [...fromReminders, ...fromDocuments, ...fromSteps].sort((a, b) => (a.info.days ?? 0) - (b.info.days ?? 0));
}

// ---------------------------------------------------------------------------------------------------------------
// Panoramica
// ---------------------------------------------------------------------------------------------------------------

export interface DossierExpenses {
  total: number;
  /** Dalla più alta; il resto sta nel totale. */
  items: { docId: string; filename: string; label: string; amount: number }[];
}

export interface DossierOverview {
  documentCount: number;
  /** L'ultimo documento aggiunto (ISO), null senza documenti. */
  lastUpdate: string | null;
  expenses: DossierExpenses | null;
  deadlines: DossierDeadline[];
  nextDeadline: DossierDeadline | null;
  /** I beni a cui sono collegati i documenti, con quanti. */
  assets: { id: string; name: string; count: number }[];
}

export function dossierOverview(input: {
  documents: DocumentSummary[];
  reminders: ReminderListItem[];
  assets: Pick<AssetListItem, "id" | "name">[];
  /** I prossimi passi del fascicolo: quelli con una data contano tra le scadenze. */
  steps?: DossierStep[];
  now: Date;
}): DossierOverview {
  const { documents, reminders, assets, now, steps } = input;

  const expenseItems = documents
    .map((doc) => ({ doc, expense: documentExpense(doc) }))
    .filter((e): e is { doc: DocumentSummary; expense: DocumentExpense } => e.expense !== null)
    .map(({ doc, expense }) => ({ docId: doc.id, filename: doc.filename, label: expense.label, amount: expense.amount }))
    .sort((a, b) => b.amount - a.amount);

  const deadlines = dossierDeadlines(documents, reminders, now, steps);

  const assetCounts = new Map<string, number>();
  for (const doc of documents) {
    if (doc.relatedAssetId) assetCounts.set(doc.relatedAssetId, (assetCounts.get(doc.relatedAssetId) ?? 0) + 1);
  }

  return {
    documentCount: documents.length,
    lastUpdate: documents.reduce<string | null>((latest, d) => (latest === null || d.createdAt > latest ? d.createdAt : latest), null),
    expenses: expenseItems.length > 0 ? { total: expenseItems.reduce((sum, e) => sum + e.amount, 0), items: expenseItems } : null,
    deadlines,
    nextDeadline: deadlines[0] ?? null,
    assets: [...assetCounts.entries()]
      .map(([id, count]) => ({ id, name: assets.find((a) => a.id === id)?.name ?? "", count }))
      .filter((a) => a.name !== "")
      .sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Cronologia
// ---------------------------------------------------------------------------------------------------------------

export type TimelineKind = "document" | "note" | "event";

export interface LivingTimelineEntry {
  id: string;
  kind: TimelineKind;
  /** ISO usato per ordinare e mostrare la data. */
  date: string;
  title: string;
  /** Una riga sotto il titolo: il tipo di contenuto o lo stato della scadenza. */
  detail: string;
  /** Per un documento o una nota, l'id da aprire. */
  documentId: string | null;
  /** Una spesa letta dal documento. */
  expense: number | null;
  /** Una scadenza completata. */
  completed: boolean;
}

/** I documenti, le note e le scadenze del fascicolo in un'unica linea, dal più recente (anche nel futuro) al più vecchio. */
export function buildLivingTimeline(
  documents: DocumentSummary[],
  reminders: ReminderListItem[],
): LivingTimelineEntry[] {
  const documentIds = new Set(documents.map((d) => d.id));

  const fromDocuments: LivingTimelineEntry[] = documents.map((doc) => {
    const isNote = doc.mimeType === NOTE_MIME_TYPE;
    return {
      id: `doc-${doc.id}`,
      kind: isNote ? "note" : "document",
      date: doc.createdAt,
      title: doc.filename,
      detail: isNote ? "Nota" : "",
      documentId: doc.id,
      expense: isNote ? null : (documentExpense(doc)?.amount ?? null),
      completed: false,
    };
  });

  const fromReminders: LivingTimelineEntry[] = reminders
    .filter((r) => r.relatedDocumentId !== null && documentIds.has(r.relatedDocumentId))
    .map((r) => ({
      id: `reminder-${r.id}`,
      kind: "event",
      date: r.dueAt,
      title: r.title,
      detail: r.completed ? "Scadenza completata" : "Scadenza",
      documentId: null,
      expense: null,
      completed: r.completed,
    }));

  return [...fromDocuments, ...fromReminders].sort((a, b) => b.date.localeCompare(a.date));
}
