import { resolveAnalysisSchema, type AnalysisValueType } from "@/domain/ai/analysis/schemas";
import type { EvalGold } from "./types";

/** Ciò che l'analisi ha prodotto per un documento, ridotto a quanto serve per confrontarlo con le risposte giuste. */
export interface Prediction {
  documentType: string;
  expiry: string[];
  issuers: string[];
  categoryName: string | null;
  fields: { key: string; value: string }[];
  events: string[];
  /** Ogni valore prodotto (anche sintesi e titoli degli eventi), per cercare i valori vietati. */
  everything: string[];
}

/** La data di riferimento del corpus: gli eventi passati non si propongono (come fa l'app, v. buildAIProposals), quindi non si contano. */
export const EVAL_TODAY = "2026-10-05";

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
}

export interface DocScore {
  typeOk: boolean;
  expiry: Counts;
  issuer: Counts;
  categoryOk: boolean;
  /** `valueOtherKey`: il valore giusto c'è, ma sotto una chiave diversa da quella del registro. */
  fields: { tp: number; valueOtherKey: number; wrongValue: number; extra: number; gold: number };
  events: Counts & { falseEvents: number };
  forbiddenHits: string[];
}

const strip = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Minuscolo, senza accenti, punteggiatura e forme societarie: "Generali Italia S.p.A." ~ "generali italia". */
export function normalizeText(text: string): string {
  return strip(text)
    .replace(/\b(s\.?\s?p\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?)(?=\s|$|[.,])/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeIdentifier(text: string): string {
  return strip(text).replace(/[^a-z0-9]/g, "");
}

/** Il primo numero scritto all'italiana ("1.234,56", "612,40", "50") come numero; null se non ce n'è. */
export function parseAmount(text: string): number | null {
  const found = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/.exec(text);
  if (!found) return null;
  return Number(found[0].replace(/\./g, "").replace(",", "."));
}

/** Due testi dicono la stessa cosa se uguali o se uno contiene l'altro (almeno 4 caratteri), dopo la normalizzazione. */
function sameText(expected: string, actual: string): boolean {
  const a = normalizeText(expected);
  const b = normalizeText(actual);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
}

export function valuesMatch(valueType: AnalysisValueType, expected: string, actual: string): boolean {
  switch (valueType) {
    case "date":
      return expected.trim() === actual.trim();
    case "amount": {
      const a = parseAmount(expected);
      const b = parseAmount(actual);
      return a !== null && b !== null && Math.abs(a - b) < 0.005;
    }
    case "identifier":
      return normalizeIdentifier(expected) === normalizeIdentifier(actual);
    default:
      return sameText(expected, actual);
  }
}

function setCounts(expected: string[], actual: string[]): Counts {
  const exp = new Set(expected);
  const act = new Set(actual);
  const tp = [...act].filter((value) => exp.has(value)).length;
  return { tp, fp: act.size - tp, fn: exp.size - tp };
}

/** Confronta ciò che l'analisi ha prodotto con le risposte giuste di un documento. */
export function scoreDocument(gold: EvalGold, prediction: Prediction): DocScore {
  const schema = resolveAnalysisSchema(gold.type);

  // Emittente: una sola risposta giusta, ma l'analisi può dare più candidati: basta che uno coincida.
  const issuerMatched = gold.issuer ? prediction.issuers.some((issuer) => sameText(gold.issuer as string, issuer)) : false;
  const issuer: Counts = {
    tp: issuerMatched ? 1 : 0,
    fn: gold.issuer && !issuerMatched ? 1 : 0,
    fp: prediction.issuers.length > 0 && !issuerMatched ? 1 : 0,
  };

  const categoryOk =
    gold.category === null
      ? prediction.categoryName === null
      : prediction.categoryName !== null && gold.category.includes(prediction.categoryName);

  let fieldTp = 0;
  let wrongValue = 0;
  let extra = 0;
  for (const predicted of prediction.fields) {
    const expectedValue = gold.fields[predicted.key];
    if (expectedValue === undefined) {
      extra += 1;
      continue;
    }
    const valueType = schema.fields.find((f) => f.key === predicted.key)?.valueType ?? "text";
    if (valuesMatch(valueType, expectedValue, predicted.value)) fieldTp += 1;
    else wrongValue += 1;
  }

  // Un campo atteso non trovato per chiave può essere comunque nel risultato con un altro nome ("premio_annuo" per "premio").
  let valueOtherKey = 0;
  for (const [key, expectedValue] of Object.entries(gold.fields)) {
    const byKey = prediction.fields.filter((f) => f.key === key);
    const valueType = schema.fields.find((f) => f.key === key)?.valueType ?? "text";
    if (byKey.some((f) => valuesMatch(valueType, expectedValue, f.value))) continue;
    if (prediction.fields.some((f) => f.key !== key && valuesMatch(valueType, expectedValue, f.value))) valueOtherKey += 1;
  }

  const futureEvents = prediction.events.filter((date) => date >= EVAL_TODAY);
  const events = setCounts(gold.events, futureEvents);
  const falseEvents = futureEvents.filter((date) => gold.notEvents.includes(date)).length;

  const haystack = prediction.everything.map((value) => value.toLowerCase());
  const forbiddenHits = (gold.forbidden ?? []).filter((forbidden) =>
    haystack.some((value) => value.includes(forbidden.toLowerCase())),
  );

  return {
    typeOk: prediction.documentType === gold.type,
    expiry: setCounts(gold.expiry, prediction.expiry),
    issuer,
    categoryOk,
    fields: { tp: fieldTp, valueOtherKey, wrongValue, extra, gold: Object.keys(gold.fields).length },
    events: { ...events, falseEvents },
    forbiddenHits,
  };
}

export interface Summary {
  documents: number;
  typeAccuracy: number;
  categoryAccuracy: number;
  expiry: { precision: number | null; recall: number | null };
  issuer: { precision: number | null; recall: number | null };
  fields: { recall: number | null; recallByValue: number | null; wrongValue: number; extra: number };
  events: { precision: number | null; recall: number | null; falseEvents: number };
  forbiddenHits: number;
}

const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);

function sum(counts: Counts[]): Counts {
  return counts.reduce((acc, c) => ({ tp: acc.tp + c.tp, fp: acc.fp + c.fp, fn: acc.fn + c.fn }), { tp: 0, fp: 0, fn: 0 });
}

/** Sommare i conteggi di tutti i documenti (non la media delle medie: un documento con più dati pesa di più). */
export function summarize(scores: DocScore[]): Summary {
  const expiry = sum(scores.map((s) => s.expiry));
  const issuer = sum(scores.map((s) => s.issuer));
  const events = sum(scores.map((s) => s.events));
  const fieldGold = scores.reduce((n, s) => n + s.fields.gold, 0);
  const fieldTp = scores.reduce((n, s) => n + s.fields.tp, 0);

  return {
    documents: scores.length,
    typeAccuracy: scores.filter((s) => s.typeOk).length / Math.max(scores.length, 1),
    categoryAccuracy: scores.filter((s) => s.categoryOk).length / Math.max(scores.length, 1),
    expiry: { precision: ratio(expiry.tp, expiry.tp + expiry.fp), recall: ratio(expiry.tp, expiry.tp + expiry.fn) },
    issuer: { precision: ratio(issuer.tp, issuer.tp + issuer.fp), recall: ratio(issuer.tp, issuer.tp + issuer.fn) },
    fields: {
      recall: ratio(fieldTp, fieldGold),
      recallByValue: ratio(fieldTp + scores.reduce((n, s) => n + s.fields.valueOtherKey, 0), fieldGold),
      wrongValue: scores.reduce((n, s) => n + s.fields.wrongValue, 0),
      extra: scores.reduce((n, s) => n + s.fields.extra, 0),
    },
    events: {
      precision: ratio(events.tp, events.tp + events.fp),
      recall: ratio(events.tp, events.tp + events.fn),
      falseEvents: scores.reduce((n, s) => n + s.events.falseEvents, 0),
    },
    forbiddenHits: scores.reduce((n, s) => n + s.forbiddenHits.length, 0),
  };
}
