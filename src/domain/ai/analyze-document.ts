import { flattenForSearch } from "@/lib/text-snippet";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";

/** FASE 22: con quale permesso si autorizza l'invio del testo a Claude --- v. AIAnalysisTrigger.tsx. */
export type AIAnalysisScope = "category" | "temporary" | "once";

interface RawField {
  value: string;
  source: string;
}

interface RawCategoryField {
  id: string;
  source: string;
}

interface RawAnalysisResult {
  expiry?: RawField[];
  issuer?: RawField[];
  category?: RawCategoryField | null;
}

/** Candidati validati --- stessa forma di StructuredField (domain/extraction/structured-fields.ts), ma da Claude. */
export interface AIExtractedFields {
  expiry: { value: string; source: string }[];
  issuer: { value: string; source: string }[];
  category: { value: string; source: string } | null;
}

/**
 * Un campo senza una citazione verificabile nel testo non è una lettura, è un'invenzione --- stessa disciplina
 * anti-hallucination già applicata al resto dell'app (v. buildProposals, "niente proposte senza una fonte").
 * Confronto tollerante agli spazi come flattenForSearch, perché Claude può normalizzare gli a capo nella citazione.
 */
function quoteAppearsIn(text: string, quote: string): boolean {
  if (!quote.trim()) return false;
  const haystack = flattenForSearch(text).toLowerCase();
  const needle = flattenForSearch(quote).toLowerCase();
  return haystack.includes(needle);
}

function isRawField(value: unknown): value is RawField {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.value === "string" && typeof v.source === "string";
}

/** Scarta in silenzio ciò che non passa la verifica --- un campo mancante costa meno di uno inventato. */
function validate(text: string, result: RawAnalysisResult, categories: Category[]): AIExtractedFields {
  const expiry = (Array.isArray(result.expiry) ? result.expiry : [])
    .filter(isRawField)
    .filter((f) => quoteAppearsIn(text, f.source));

  const issuer = (Array.isArray(result.issuer) ? result.issuer : [])
    .filter(isRawField)
    .filter((f) => quoteAppearsIn(text, f.source));

  let category: AIExtractedFields["category"] = null;
  if (
    result.category &&
    typeof result.category.id === "string" &&
    typeof result.category.source === "string" &&
    categories.some((c) => c.id === result.category?.id) &&
    quoteAppearsIn(text, result.category.source)
  ) {
    category = { value: result.category.id, source: result.category.source };
  }

  return { expiry, issuer, category };
}

/** Chiede a Claude di leggere un documento, via la route server-side (mai dal browser). Lancia se il gate lato server rifiuta. */
export async function analyzeDocumentWithClaude(
  doc: Pick<DocumentListItem, "id" | "extractedText">,
  categories: Category[],
  scope: AIAnalysisScope,
): Promise<AIExtractedFields> {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: doc.id,
      text: doc.extractedText,
      categories: categories.map((c) => ({ id: c.id, name: c.name })),
      scope,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Impossibile analizzare il documento con Claude.");
  }

  const data = await response.json();
  return validate(doc.extractedText, (data?.result ?? {}) as RawAnalysisResult, categories);
}

/**
 * Stessa logica di filtro di buildProposals (domain/proposals/build.ts) --- niente su campi già compilati, niente
 * già rifiutato, dedup --- ma sui candidati letti da Claude. Non riusa buildProposals: quello resta il percorso
 * locale, testato, invariato; questo è un percorso a parte per candidati con una provenienza diversa.
 */
export function buildAIProposals(
  doc: Pick<DocumentListItem, "expiresAt" | "issuer" | "categoryId">,
  fields: AIExtractedFields,
  rejections: ProposalRejection[],
): Proposal[] {
  const proposals: Proposal[] = [];

  if (!doc.expiresAt) {
    for (const f of fields.expiry) {
      proposals.push({ kind: "expiry", value: f.value, source: f.source, aiGenerated: true });
    }
  }

  if (!doc.categoryId && fields.category) {
    proposals.push({ kind: "category", value: fields.category.value, source: fields.category.source, aiGenerated: true });
  }

  if (!doc.issuer) {
    for (const f of fields.issuer) {
      proposals.push({ kind: "issuer", value: f.value, source: f.source, aiGenerated: true });
    }
  }

  const deduped = proposals.filter(
    (proposal, index) =>
      !proposals.slice(0, index).some((p) => p.kind === proposal.kind && p.value === proposal.value),
  );

  return deduped.filter(
    (proposal) => !rejections.some((r) => r.kind === proposal.kind && r.value === proposal.value),
  );
}
