import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { buildAIProposals, extractedFieldsFrom } from "@/domain/ai/analyze-document";
import type { SummaryContext } from "@/domain/ai/types";
import type { TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { listTypeCategoryOverrides } from "@/domain/categories/type-categories";
import { dayKey } from "@/domain/dashboard/deadlines";
import { getDocumentById } from "@/domain/documents/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import { listProposalRejections } from "@/domain/proposals/repository";
import type { ProposalRejection } from "@/domain/proposals/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/** Quanti documenti letti da Hinthia hanno ancora proposte da decidere, quante in tutto, e il primo documento da aprire. */
export interface PendingProposals {
  documents: number;
  proposals: number;
  first: { id: string; filename: string; count: number } | null;
}

/** Quanti documenti recenti si controllano: il conto è un avviso, non un inventario (ogni documento costa una lettura). */
const MAX_DOCUMENTS = 12;

/** Quante proposte restano da decidere su un documento letto: quelle della sua lettura, tolte le già decise (come nella scheda). */
export function pendingProposalCount(
  doc: DocumentListItem,
  categories: { id: string; name?: string }[],
  typeCategories: TypeCategoryOverrides,
  rejections: ProposalRejection[],
  reminders: ReminderListItem[],
  today: string,
): number {
  if (!doc.contentAnalysis) return 0;
  const fields = extractedFieldsFrom(doc.contentAnalysis, categories, typeCategories);
  const existingDates = reminders.filter((r) => r.relatedDocumentId === doc.id).map((r) => dayKey(new Date(r.dueAt)));
  return buildAIProposals(doc, fields, rejections, { today, existingDates }).length;
}

/** Mette insieme i conteggi dei singoli documenti. */
export function summarizePending(counts: { id: string; filename: string; count: number }[]): PendingProposals {
  const withProposals = counts.filter((c) => c.count > 0);
  return {
    documents: withProposals.length,
    proposals: withProposals.reduce((sum, c) => sum + c.count, 0),
    first: withProposals[0] ?? null,
  };
}

/**
 * Le proposte di Hinthia ancora da decidere, sui documenti letti più di recente. Si calcolano qui nel browser, come
 * nella scheda del documento (il server non le vede mai nascere): per ogni documento letto si decifra la lettura e si
 * tolgono le proposte già accettate o rifiutate. Non propone beni (richiederebbe i campi degli altri documenti): il
 * conteggio può quindi essere appena più basso di quello della scheda.
 */
export async function loadPendingProposals(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  context: SummaryContext,
  now: Date,
): Promise<PendingProposals> {
  const read = context.documents
    .filter((d) => d.analysisStatus !== null)
    .sort((a, b) => (b.analysisUpdatedAt ?? b.createdAt).localeCompare(a.analysisUpdatedAt ?? a.createdAt))
    .slice(0, MAX_DOCUMENTS);
  if (read.length === 0) return { documents: 0, proposals: 0, first: null };

  const typeCategories = await listTypeCategoryOverrides(supabase).catch((): TypeCategoryOverrides => ({}));
  const today = dayKey(now);

  const counts = await Promise.all(
    read.map(async (summary) => {
      try {
        const [doc, rejections] = await Promise.all([
          getDocumentById(supabase, masterKey, summary.id),
          listProposalRejections(supabase, masterKey, summary.id),
        ]);
        if (!doc) return { id: summary.id, filename: summary.filename, count: 0 };
        return {
          id: doc.id,
          filename: doc.filename,
          count: pendingProposalCount(doc, context.categories, typeCategories, rejections, context.reminders, today),
        };
      } catch {
        // Un documento che non si legge non deve nascondere l'avviso per gli altri.
        return { id: summary.id, filename: summary.filename, count: 0 };
      }
    }),
  );

  return summarizePending(counts);
}
