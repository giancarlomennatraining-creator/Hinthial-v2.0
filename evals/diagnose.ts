import { resolveAnalysisSchema, type AnalysisValueType } from "@/domain/ai/analysis/schemas";
import type { RawBlockAnalysis } from "@/domain/ai/analysis/types";
import { normalizeDateValue, quoteAppearsIn, valueMatchesQuote } from "@/domain/ai/analysis/validate";
import { normalizeFieldKey } from "@/domain/structured-fields/normalize";
import type { EvalDocument } from "./types";

/** Perché la validazione scarta una lettura del motore: la stessa sequenza di controlli di `validateBlock`, ma con il motivo. */
export type DiscardReason = "segmento sconosciuto" | "citazione non trovata nel segmento" | "valore non coerente con la citazione" | "titolo troppo lungo" | "categoria non valida";

export interface DiscardedItem {
  documentId: string;
  what: "scadenza" | "emittente" | "categoria" | "campo" | "evento";
  label: string;
  value: string;
  quote: string;
  reason: DiscardReason;
}

function judge(
  segments: Map<string, string>,
  item: { value: string; segmentId: string; quote: string },
  valueType: AnalysisValueType,
): DiscardReason | null {
  const text = segments.get(item.segmentId);
  if (text === undefined) return "segmento sconosciuto";
  if (!quoteAppearsIn(text, item.quote)) return "citazione non trovata nel segmento";
  const value = valueType === "date" ? normalizeDateValue(item.value) : item.value.trim();
  if (!valueMatchesQuote(value, item.quote, valueType)) return "valore non coerente con la citazione";
  return null;
}

/** Le letture grezze del motore che la validazione scarterebbe, con il motivo. `type` è il tipo deciso al primo blocco. */
export function diagnoseDocument(
  document: EvalDocument,
  raw: RawBlockAnalysis[],
  categoryIds: string[],
  type: string,
): DiscardedItem[] {
  const segments = new Map(document.pages.map((text, index) => [`p${index + 1}`, text.trim()]));
  const schema = resolveAnalysisSchema(type);
  const found: DiscardedItem[] = [];

  for (const block of raw) {
    for (const item of block.expiry) {
      const reason = judge(segments, item, "date");
      if (reason) found.push({ documentId: document.id, what: "scadenza", label: "", value: item.value, quote: item.quote, reason });
    }
    for (const item of block.issuer) {
      const reason = judge(segments, item, "text");
      if (reason) found.push({ documentId: document.id, what: "emittente", label: "", value: item.value, quote: item.quote, reason });
    }
    if (block.category) {
      const text = segments.get(block.category.segmentId);
      const reason: DiscardReason | null = !categoryIds.includes(block.category.id)
        ? "categoria non valida"
        : text === undefined
          ? "segmento sconosciuto"
          : quoteAppearsIn(text, block.category.quote)
            ? null
            : "citazione non trovata nel segmento";
      if (reason) found.push({ documentId: document.id, what: "categoria", label: "", value: block.category.id, quote: block.category.quote, reason });
    }
    for (const item of block.fields) {
      const key = normalizeFieldKey(item.key) ?? item.key;
      const valueType = schema.fields.find((f) => f.key === key)?.valueType ?? "text";
      const reason = judge(segments, item, valueType);
      if (reason) found.push({ documentId: document.id, what: "campo", label: key, value: item.value, quote: item.quote, reason });
    }
    for (const item of block.events) {
      const reason: DiscardReason | null = item.title.trim().length > 80 ? "titolo troppo lungo" : judge(segments, item, "date");
      if (reason) found.push({ documentId: document.id, what: "evento", label: item.title, value: item.value, quote: item.quote, reason });
    }
  }
  return found;
}

/** Riepilogo dei motivi, con qualche esempio per motivo e tipo di dato. */
export function formatDiagnosis(items: DiscardedItem[], examplesPerGroup = 4): string {
  const lines: string[] = [`Letture scartate dalla validazione: ${items.length}`];
  const groups = new Map<string, DiscardedItem[]>();
  for (const item of items) {
    const key = `${item.what} - ${item.reason}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push("", `${key}: ${list.length}`);
    for (const item of list.slice(0, examplesPerGroup)) {
      const label = item.label ? ` ${item.label}` : "";
      lines.push(`  ${item.documentId}${label}: valore "${item.value}" | citazione "${item.quote.replace(/\s+/g, " ").slice(0, 90)}"`);
    }
  }
  return lines.join("\n");
}
