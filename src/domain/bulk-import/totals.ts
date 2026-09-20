import { extractStructuredFields } from "@/domain/extraction/structured-fields";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * FASE 21 --- "totali di spesa per anno e categoria".
 *
 * Limite deliberato, dal piano: **mostrare i numeri, mai interpretarli.**
 * Questa funzione somma e basta --- nessun confronto tra anni, nessun
 * "quest'anno hai speso più del solito", nessuna soglia che segnali un
 * valore fuori norma. Se un documento stesso dichiara qualcosa di
 * anomalo, lo dice lui nel proprio testo; non è compito di questa
 * funzione deciderlo per l'utente.
 */

export interface YearCategoryTotal {
  year: number;
  /** null = nessuna categoria assegnata. */
  categoryId: string | null;
  /** Somma come stringa decimale, mai "0" per un gruppo senza importi --- v. sotto: un gruppo così non esiste nel risultato. */
  total: string;
  /** Quanti documenti hanno contribuito alla somma --- non quanti ce ne sono in quell'anno/categoria in assoluto. */
  documentCount: number;
}

/** L'anno da cui contare: quello letto nel documento (FASE 18) se c'è, altrimenti quello di caricamento. */
function effectiveYear(document: DocumentListItem, fields: ReturnType<typeof extractStructuredFields>): number {
  const documentDate = fields.find((field) => field.kind === "document-date")?.value;
  return new Date(documentDate ?? document.createdAt).getUTCFullYear();
}

/**
 * I totali per anno e categoria, su tutti i documenti che hanno un
 * importo riconosciuto. Un documento senza importo non entra in nessun
 * gruppo --- non esiste un gruppo "anno 2026 / Salute" con totale zero
 * per un anno in cui non è stato riconosciuto nessun importo: quel
 * gruppo semplicemente non compare, invece di mostrare uno zero che
 * sembrerebbe un dato vero.
 *
 * Ordinato per anno decrescente (il più recente prima), poi per
 * categoria --- l'ordine in cui normalmente si vuole rivedere una spesa.
 */
export function totalsByYearAndCategory(documents: DocumentListItem[]): YearCategoryTotal[] {
  const groups = new Map<string, { year: number; categoryId: string | null; cents: number; count: number }>();

  for (const document of documents) {
    const fields = extractStructuredFields(document.extractedText);
    const amount = fields.find((field) => field.kind === "amount");
    if (!amount) continue;

    const year = effectiveYear(document, fields);
    const key = `${year}:${document.categoryId ?? ""}`;
    const [whole, cents] = amount.value.split(".");
    const amountCents = Number(whole) * 100 + Number(cents ?? "0");

    const existing = groups.get(key);
    if (existing) {
      existing.cents += amountCents;
      existing.count += 1;
    } else {
      groups.set(key, { year, categoryId: document.categoryId, cents: amountCents, count: 1 });
    }
  }

  return Array.from(groups.values())
    .map(({ year, categoryId, cents, count }) => ({
      year,
      categoryId,
      total: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`,
      documentCount: count,
    }))
    .sort((a, b) => b.year - a.year || (a.categoryId ?? "").localeCompare(b.categoryId ?? ""));
}
