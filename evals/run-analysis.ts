import { prepareAnalysis } from "@/domain/ai/analysis/blocks";
import { defaultCategoryFor } from "@/domain/ai/analysis/category-defaults";
import { mergeBlocks } from "@/domain/ai/analysis/merge";
import { isAnalysisDocumentType, resolveAnalysisSchema, type AnalysisDocumentType } from "@/domain/ai/analysis/schemas";
import type { AnalysisProvider, RawBlockAnalysis } from "@/domain/ai/analysis/types";
import { validateBlock, type ValidatedBlock } from "@/domain/ai/analysis/validate";
import type { ContentSegment } from "@/domain/extraction/types";
import type { Prediction } from "./score";
import type { EvalDocument } from "./types";

/** Le dieci categorie che ogni utente ha alla registrazione (v. migrazione documents_vault): stessi nomi, id fittizi. */
export const EVAL_CATEGORIES = [
  "Personale",
  "Casa",
  "Veicoli",
  "Assicurazioni",
  "Contratti",
  "Fiscale",
  "Salute",
  "Finanze",
  "Account",
  "Altro",
].map((name) => ({ id: `cat-${name.toLowerCase()}`, name }));

/** Quante letture il motore ha dato e la validazione ha scartato (citazione non trovata, valore incoerente...). */
export interface Discarded {
  expiry: number;
  issuer: number;
  category: number;
  fields: number;
  events: number;
}

export interface AnalysisRun {
  prediction: Prediction;
  discarded: Discarded;
  /** L'uscita grezza del motore per blocco, prima della validazione: per capire se un dato mancante è colpa del motore o della verifica. */
  raw: RawBlockAnalysis[];
  calls: number;
  ms: number;
  /** Caratteri di testo spediti al motore, in tutti i blocchi. */
  charsSent: number;
}

/**
 * La stessa catena dell'app (blocchi, motore, validazione delle citazioni, fusione), senza rete né database: ciò che
 * avviene in `analyzeDocumentWithClaude` (domain/ai/analyze-document.ts) tolta la persistenza. Il tipo si decide al
 * primo blocco e vale per i successivi, come in produzione.
 */
export async function runAnalysis(document: EvalDocument, provider: AnalysisProvider): Promise<AnalysisRun> {
  const started = Date.now();
  const segments: ContentSegment[] = document.pages
    .map((text, index) => ({ id: `p${index + 1}`, kind: "page" as const, index: index + 1, text: text.trim() }))
    .filter((segment) => segment.text.length > 0);
  const text = segments.map((segment) => segment.text).join("\n\n") || null;
  const prepared = prepareAnalysis({ segments, text });

  let documentType: AnalysisDocumentType | null = null;
  let calls = 0;
  let charsSent = 0;
  const blocks: ValidatedBlock[] = [];
  const raws: RawBlockAnalysis[] = [];
  const discarded: Discarded = { expiry: 0, issuer: 0, category: 0, fields: 0, events: 0 };

  for (const block of prepared.blocks) {
    calls += 1;
    charsSent += block.text.length;
    const raw = await provider.analyzeBlock({ block, categories: EVAL_CATEGORIES, vocabulary: [], documentType });
    documentType ??= isAnalysisDocumentType(raw.documentType) ? raw.documentType : "generico";
    const validated = validateBlock(raw, prepared.segments, EVAL_CATEGORIES, resolveAnalysisSchema(documentType));
    blocks.push(validated);
    raws.push(raw);
    discarded.expiry += raw.expiry.length - validated.expiry.length;
    discarded.issuer += raw.issuer.length - validated.issuer.length;
    discarded.category += (raw.category ? 1 : 0) - (validated.category ? 1 : 0);
    discarded.fields += raw.fields.length - validated.fields.length;
    discarded.events += raw.events.length - validated.events.length;
  }

  const merged = mergeBlocks(blocks);
  // Come in produzione (extractedFieldsFrom): senza una categoria dal motore, quella che di norma va con il tipo.
  const category = merged.category
    ? EVAL_CATEGORIES.find((c) => c.id === merged.category?.value)
    : defaultCategoryFor(documentType, EVAL_CATEGORIES);

  const prediction: Prediction = {
    documentType: documentType ?? "generico",
    expiry: merged.expiry.map((e) => e.value),
    issuers: merged.issuer.map((e) => e.value),
    categoryName: category?.name ?? null,
    fields: merged.fields.map((f) => ({ key: f.key, value: f.value })),
    events: merged.events.map((e) => e.value),
    everything: [
      ...merged.expiry.map((e) => e.value),
      ...merged.issuer.map((e) => e.value),
      ...merged.fields.map((f) => f.value),
      ...merged.events.flatMap((e) => [e.value, e.title]),
      ...merged.partialSyntheses,
    ],
  };

  return { prediction, discarded, raw: raws, calls, ms: Date.now() - started, charsSent };
}
