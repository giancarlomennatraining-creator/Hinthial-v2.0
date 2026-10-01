import type {
  RawBlockAnalysis,
  RawCategoryEvidence,
  RawEvidence,
  RawFieldEvidence,
} from "@/domain/ai/analysis/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseEvidence(value: unknown): RawEvidence | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.value) || !isNonEmptyString(value.segmentId) || !isNonEmptyString(value.quote)) return null;
  return { value: value.value, segmentId: value.segmentId, quote: value.quote };
}

function parseFieldEvidence(value: unknown): RawFieldEvidence | null {
  const evidence = parseEvidence(value);
  if (!evidence || !isRecord(value)) return null;
  if (!isNonEmptyString(value.key) || !isNonEmptyString(value.label)) return null;
  return { ...evidence, key: value.key, label: value.label };
}

/** Un modello piccolo a volte restituisce un elenco o un oggetto come testo JSON invece che come struttura: lo si rimette in forma. */
function unwrapJsonText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("[") && !text.startsWith("{")) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function parseCategory(rawValue: unknown): RawCategoryEvidence | null {
  const value = unwrapJsonText(rawValue);
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!isRecord(candidate)) return null;
  if (!isNonEmptyString(candidate.id) || !isNonEmptyString(candidate.segmentId) || !isNonEmptyString(candidate.quote)) {
    return null;
  }
  return { id: candidate.id, segmentId: candidate.segmentId, quote: candidate.quote };
}

function parseList<T>(rawValue: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  const value = unwrapJsonText(rawValue);
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  return value.map(parseItem).filter((item): item is T => item !== null);
}

/**
 * Controllo di forma sull'output strutturato del modello, al posto del vecchio parseClaudeJson: se la struttura non è
 * quella attesa il risultato è null (= "validazione fallita", mai accettato). Dentro un elenco, una voce malformata si
 * scarta da sola: non rende invalido il resto.
 */
export function parseBlockAnalysis(raw: unknown): RawBlockAnalysis | null {
  if (!isRecord(raw)) return null;

  const expiry = parseList(raw.expiry, parseEvidence);
  const issuer = parseList(raw.issuer, parseEvidence);
  const fields = parseList(raw.fields, parseFieldEvidence);
  if (!expiry || !issuer || !fields) return null;

  return {
    documentType: isNonEmptyString(raw.documentType) ? raw.documentType : null,
    expiry,
    issuer,
    category: parseCategory(raw.category),
    fields,
    synthesis: isNonEmptyString(raw.synthesis) ? raw.synthesis.trim() : null,
  };
}
