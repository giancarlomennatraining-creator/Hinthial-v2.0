import type { DocumentSummary } from "@/domain/documents/types";

/**
 * I documenti attesi di un fascicolo: una piccola lista di cose che mancano ("referto", "fattura dell'intervento").
 * Una voce risulta fatta da sola quando nel fascicolo c'è un documento che la nomina; altrimenti la si spunta a mano.
 * Puro: nessuna rete, nessun database.
 */

export interface ExpectedItem {
  id: string;
  label: string;
  /** Spunta a mano. */
  done: boolean;
}

export interface ExpectedStatus {
  item: ExpectedItem;
  /** Il documento del fascicolo che soddisfa la voce, se ce n'è uno. */
  documentId: string | null;
  documentName: string | null;
  /** Fatta: da un documento o spuntata a mano. */
  satisfied: boolean;
}

export interface ExpectedSummary {
  statuses: ExpectedStatus[];
  done: number;
  total: number;
}

// Parole che non dicono cosa è il documento: non devono bastare ad abbinarne uno.
const STOPWORDS = new Set([
  "del", "della", "dello", "delle", "dei", "degli", "dal", "dalla", "per", "con", "sul", "sulla", "una", "uno", "the", "and",
  "copia", "documento", "documenti",
]);

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * La radice di una parola, senza la vocale finale: "fattura" e "fatture" diventano la stessa "fattur", "referto" e
 * "referti" la stessa "refert". Le parole corte restano intere.
 */
function stem(word: string): string {
  return word.length > 4 && /[aeio]$/.test(word) ? word.slice(0, -1) : word;
}

function significantStems(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map(stem);
}

function searchableText(doc: DocumentSummary): string {
  const fields = Object.values(doc.structuredFields ?? {});
  return fold([doc.filename, doc.issuer, doc.notes, ...doc.tags, ...fields].filter(Boolean).join(" "));
}

/**
 * Per ogni voce, il primo documento (non già dato a una voce precedente) in cui compaiono tutte le sue parole
 * significative, nel nome, nell'emittente, nei tag, nelle note o nei campi letti. Una voce senza parole significative non
 * si abbina mai da sola: resta da spuntare a mano.
 */
export function matchExpected(items: ExpectedItem[], documents: DocumentSummary[]): ExpectedSummary {
  const taken = new Set<string>();
  const texts = documents.map((doc) => ({ doc, text: searchableText(doc) }));

  const statuses = items.map((item): ExpectedStatus => {
    const stems = significantStems(item.label);
    const found =
      stems.length === 0
        ? undefined
        : texts.find(({ doc, text }) => !taken.has(doc.id) && stems.every((s) => text.includes(s)));
    if (found) taken.add(found.doc.id);
    return {
      item,
      documentId: found?.doc.id ?? null,
      documentName: found?.doc.filename ?? null,
      satisfied: item.done || found !== undefined,
    };
  });

  return { statuses, done: statuses.filter((s) => s.satisfied).length, total: statuses.length };
}
