import type { ValidatedBlock, ValidatedEvidence, ValidatedField } from "@/domain/ai/analysis/validate";

export interface MergedAnalysis {
  expiry: ValidatedEvidence[];
  issuer: ValidatedEvidence[];
  category: ValidatedEvidence | null;
  fields: ValidatedField[];
  /** Sintesi parziali dei blocchi, in ordine: da fondere in una sola (un solo blocco = nessuna fusione necessaria). */
  partialSyntheses: string[];
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Unisce i risultati dei blocchi, già validati, in ordine di documento. Lo stesso valore trovato in più punti compare
 * una volta, con la provenienza della prima occorrenza; per un campo con lo stesso nome ma valori diversi vince il
 * primo (la contraddizione è rara e una scelta silenziosa è meglio di due proposte per la stessa casella).
 */
export function mergeBlocks(blocks: ValidatedBlock[]): MergedAnalysis {
  return {
    expiry: uniqueBy(blocks.flatMap((b) => b.expiry), (e) => e.value),
    issuer: uniqueBy(blocks.flatMap((b) => b.issuer), (e) => e.value.toLowerCase()),
    category: blocks.find((b) => b.category)?.category ?? null,
    fields: uniqueBy(blocks.flatMap((b) => b.fields), (f) => f.key),
    partialSyntheses: blocks.map((b) => b.synthesis).filter((s): s is string => !!s),
  };
}
