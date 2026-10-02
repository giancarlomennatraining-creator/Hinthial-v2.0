import type { ValidatedBlock, ValidatedEvent, ValidatedEvidence, ValidatedField } from "@/domain/ai/analysis/validate";

export interface MergedAnalysis {
  expiry: ValidatedEvidence[];
  issuer: ValidatedEvidence[];
  category: ValidatedEvidence | null;
  fields: ValidatedField[];
  events: ValidatedEvent[];
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
 * La categoria è una proprietà dell'intero documento, ma ogni blocco ne vede solo una parte: si sceglie quella proposta
 * da più blocchi, non quella del primo (una copertina o un indice possono fuorviare). A parità vince la più vicina
 * all'inizio del documento.
 */
function pickCategory(blocks: ValidatedBlock[]): ValidatedEvidence | null {
  const votes = new Map<string, { count: number; first: ValidatedEvidence }>();
  for (const block of blocks) {
    if (!block.category) continue;
    const entry = votes.get(block.category.value);
    if (entry) entry.count += 1;
    else votes.set(block.category.value, { count: 1, first: block.category });
  }
  let best: { count: number; first: ValidatedEvidence } | null = null;
  for (const entry of votes.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.first ?? null;
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
    category: pickCategory(blocks),
    fields: uniqueBy(blocks.flatMap((b) => b.fields), (f) => f.key),
    // Un evento è identificato dalla data: lo stesso giorno citato in più punti, anche con parole diverse, è una sola scadenza.
    events: uniqueBy(blocks.flatMap((b) => b.events), (e) => e.value),
    partialSyntheses: blocks.map((b) => b.synthesis).filter((s): s is string => !!s),
  };
}
