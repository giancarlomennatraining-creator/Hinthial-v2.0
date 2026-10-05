import { prepareAnalysis } from "@/domain/ai/analysis/blocks";
import { mergeBlocks } from "@/domain/ai/analysis/merge";
import { isAnalysisDocumentType, resolveAnalysisSchema, type AnalysisDocumentType } from "@/domain/ai/analysis/schemas";
import type { AnalysisProvider } from "@/domain/ai/analysis/types";
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

export interface AnalysisRun {
  prediction: Prediction;
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

  for (const block of prepared.blocks) {
    calls += 1;
    charsSent += block.text.length;
    const raw = await provider.analyzeBlock({ block, categories: EVAL_CATEGORIES, vocabulary: [], documentType });
    documentType ??= isAnalysisDocumentType(raw.documentType) ? raw.documentType : "generico";
    blocks.push(validateBlock(raw, prepared.segments, EVAL_CATEGORIES, resolveAnalysisSchema(documentType)));
  }

  const merged = mergeBlocks(blocks);
  const category = merged.category ? EVAL_CATEGORIES.find((c) => c.id === merged.category?.value) : undefined;

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

  return { prediction, calls, ms: Date.now() - started, charsSent };
}
