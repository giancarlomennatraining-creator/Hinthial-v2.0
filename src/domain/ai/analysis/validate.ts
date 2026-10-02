import { flattenForSearch } from "@/lib/text-snippet";
import { findDateContext } from "@/domain/extraction/structured-fields";
import { normalizeFieldKey } from "@/domain/structured-fields/normalize";
import type { AnalysisSchema, AnalysisValueType } from "@/domain/ai/analysis/schemas";
import type { AnalysisSegment, RawBlockAnalysis } from "@/domain/ai/analysis/types";

/** Da dove viene una lettura: il segmento indicato dal modello e, se il documento ha pagine, quale. */
export interface Provenance {
  segmentId: string;
  page: number | null;
}

export interface ValidatedEvidence {
  value: string;
  /** La citazione, verificata nel segmento indicato. */
  source: string;
  provenance: Provenance;
}

export interface ValidatedField extends ValidatedEvidence {
  key: string;
  label: string;
}

/** Un evento con data: `value` è la data (YYYY-MM-DD), `title` è come si chiamerà la scadenza. */
export interface ValidatedEvent extends ValidatedEvidence {
  title: string;
}

export interface ValidatedBlock {
  expiry: ValidatedEvidence[];
  issuer: ValidatedEvidence[];
  category: ValidatedEvidence | null;
  fields: ValidatedField[];
  events: ValidatedEvent[];
  /** Derivata: una lettura d'insieme, mai presentata come citazione. */
  synthesis: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Il titolo di una scadenza è una riga, non un paragrafo: oltre questo, il modello ha riassunto invece di nominare. */
const MAX_EVENT_TITLE_LENGTH = 80;

/**
 * Una citazione che non compare nel testo non è una lettura, è un'invenzione. Confronto tollerante agli spazi come
 * flattenForSearch, perché il modello può normalizzare gli a capo.
 */
export function quoteAppearsIn(text: string, quote: string): boolean {
  if (!quote.trim()) return false;
  const haystack = flattenForSearch(text).toLowerCase();
  const needle = flattenForSearch(quote).toLowerCase();
  return haystack.includes(needle);
}

function alphanumeric(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Il valore dichiarato deve essere ciò che la citazione dice. Una data si rilegge dalla citazione e si confronta in
 * forma normalizzata (`14 marzo 2026` e `2026-03-14` sono la stessa data); il resto per caratteri alfanumerici, che
 * rende equivalenti `1.234,56` e `1234.56` ma non un numero diverso.
 */
export function valueMatchesQuote(value: string, quote: string, valueType: AnalysisValueType): boolean {
  if (valueType === "date" || ISO_DATE.test(value.trim())) {
    return ISO_DATE.test(value.trim()) && findDateContext(quote, value.trim()) !== null;
  }
  const wanted = alphanumeric(value);
  return wanted.length > 0 && alphanumeric(quote).includes(wanted);
}

function checkEvidence(
  evidence: { value: string; segmentId: string; quote: string },
  valueType: AnalysisValueType,
  segments: Map<string, AnalysisSegment>,
): Provenance | null {
  const segment = segments.get(evidence.segmentId);
  if (!segment) return null;
  if (!quoteAppearsIn(segment.text, evidence.quote)) return null;
  if (!valueMatchesQuote(evidence.value, evidence.quote, valueType)) return null;
  return { segmentId: segment.id, page: segment.page };
}

/**
 * Tiene solo ciò che regge: citazione nel segmento indicato, valore coerente con la citazione, categoria tra quelle
 * fornite. Il resto si scarta in silenzio: un campo mancante costa meno di uno inventato.
 */
export function validateBlock(
  raw: RawBlockAnalysis,
  segments: AnalysisSegment[],
  categories: { id: string }[],
  schema: AnalysisSchema,
): ValidatedBlock {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));

  const evidenceOf = (list: RawBlockAnalysis["expiry"], valueType: AnalysisValueType): ValidatedEvidence[] =>
    list.flatMap((item) => {
      const provenance = checkEvidence(item, valueType, byId);
      return provenance ? [{ value: item.value.trim(), source: item.quote, provenance }] : [];
    });

  let category: ValidatedEvidence | null = null;
  if (raw.category && categories.some((c) => c.id === raw.category?.id)) {
    const segment = byId.get(raw.category.segmentId);
    if (segment && quoteAppearsIn(segment.text, raw.category.quote)) {
      category = {
        value: raw.category.id,
        source: raw.category.quote,
        provenance: { segmentId: segment.id, page: segment.page },
      };
    }
  }

  const fields = raw.fields.flatMap((item): ValidatedField[] => {
    const key = normalizeFieldKey(item.key);
    if (!key) return [];
    const valueType = schema.fields.find((f) => f.key === key)?.valueType ?? "text";
    const provenance = checkEvidence(item, valueType, byId);
    return provenance ? [{ key, label: item.label.trim(), value: item.value.trim(), source: item.quote, provenance }] : [];
  });

  const events = raw.events.flatMap((item): ValidatedEvent[] => {
    const title = item.title.trim().replace(/\s+/g, " ");
    if (!title || title.length > MAX_EVENT_TITLE_LENGTH) return [];
    const provenance = checkEvidence(item, "date", byId);
    return provenance ? [{ title, value: item.value.trim(), source: item.quote, provenance }] : [];
  });

  return {
    expiry: evidenceOf(raw.expiry, "date"),
    issuer: evidenceOf(raw.issuer, "text"),
    category,
    fields,
    events,
    synthesis: raw.synthesis,
  };
}
