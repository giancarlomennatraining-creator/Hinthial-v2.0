import { isAnalysisDocumentType, type AnalysisDocumentType } from "@/domain/ai/analysis/schemas";
import type {
  Provenance,
  ValidatedBlock,
  ValidatedEvidence,
  ValidatedField,
} from "@/domain/ai/analysis/validate";

/**
 * Stato grossolano della lettura, l'unica parte in chiaro (colonna `analysis_status`): dice a che punto è, mai che cosa
 * dice il documento. "pending" = in corso o interrotta, "failed" = fermata da un errore, "partial" = letto tutto ma
 * senza la sintesi finale o solo in parte (tetto per documento), "completed" = letto e sintetizzato.
 */
export const ANALYSIS_STATUSES = ["pending", "completed", "partial", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export function isAnalysisStatus(value: unknown): value is AnalysisStatus {
  return typeof value === "string" && (ANALYSIS_STATUSES as readonly string[]).includes(value);
}

/**
 * Ciò che resta di una lettura di Hinthia, tutto cifrato con la Master Key in `documents.encrypted_content_analysis`.
 * I blocchi sono quelli già letti e validati, in ordine: la ripresa dopo un'interruzione parte dal primo mancante.
 */
export interface PersistedContentAnalysis {
  v: 1;
  /** HMAC (v. lib/crypto/fingerprint.ts) di contenuto + versioni + modelli: dice se una lettura salvata vale ancora. */
  fingerprint: string;
  schemaVersion: number;
  pipelineVersion: number;
  models: { block: string; merge: string };
  /** Deciso al primo blocco e valido per i successivi; null finché nessun blocco è stato letto. */
  documentType: AnalysisDocumentType | null;
  /** Quanti blocchi si leggono in tutto (dopo il tetto per documento). */
  blocksTotal: number;
  /** Quanti ne servirebbero per leggere tutto, prima del tetto. */
  blocksTotalBeforeCap: number;
  truncated: boolean;
  blocks: ValidatedBlock[];
  synthesis: string | null;
  /** False finché la fusione delle sintesi parziali non è riuscita (o se è fallita e si è ripiegato sulle parziali). */
  mergeDone: boolean;
  updatedAt: string;
}

export function statusOf(analysis: PersistedContentAnalysis): AnalysisStatus {
  if (analysis.blocks.length < analysis.blocksTotal) return "pending";
  return analysis.mergeDone && !analysis.truncated ? "completed" : "partial";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

function parseProvenance(value: unknown): Provenance | null {
  if (!isRecord(value) || !isString(value.segmentId)) return null;
  if (value.page !== null && (typeof value.page !== "number" || !Number.isInteger(value.page))) return null;
  return { segmentId: value.segmentId, page: value.page as number | null };
}

function parseEvidence(value: unknown): ValidatedEvidence | null {
  if (!isRecord(value) || !isString(value.value) || !isString(value.source)) return null;
  const provenance = parseProvenance(value.provenance);
  return provenance ? { value: value.value, source: value.source, provenance } : null;
}

function parseField(value: unknown): ValidatedField | null {
  const evidence = parseEvidence(value);
  if (!evidence || !isRecord(value) || !isString(value.key) || !isString(value.label)) return null;
  return { ...evidence, key: value.key, label: value.label };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parse);
  return items.every((item): item is T => item !== null) ? items : null;
}

function parseBlock(value: unknown): ValidatedBlock | null {
  if (!isRecord(value)) return null;
  const expiry = parseList(value.expiry, parseEvidence);
  const issuer = parseList(value.issuer, parseEvidence);
  const fields = parseList(value.fields, parseField);
  if (!expiry || !issuer || !fields) return null;
  const category = value.category === null ? null : parseEvidence(value.category);
  if (value.category !== null && !category) return null;
  if (value.synthesis !== null && !isString(value.synthesis)) return null;
  return { expiry, issuer, category, fields, synthesis: value.synthesis as string | null };
}

/**
 * Rilegge ciò che ha scritto saveContentAnalysis. Un blocco cifrato che non si capisce (scritto da una versione futura,
 * o danneggiato) vale "nessuna lettura salvata": l'utente può rileggere, non resta con un errore su ogni apertura.
 */
export function parsePersistedAnalysis(value: unknown): PersistedContentAnalysis | null {
  if (!isRecord(value) || value.v !== 1) return null;
  if (!isString(value.fingerprint) || !isString(value.updatedAt)) return null;
  if (!Number.isInteger(value.schemaVersion) || !Number.isInteger(value.pipelineVersion)) return null;
  if (!isRecord(value.models) || !isString(value.models.block) || !isString(value.models.merge)) return null;
  if (!Number.isInteger(value.blocksTotal) || !Number.isInteger(value.blocksTotalBeforeCap)) return null;
  if (typeof value.truncated !== "boolean" || typeof value.mergeDone !== "boolean") return null;
  if (value.synthesis !== null && !isString(value.synthesis)) return null;
  if (value.documentType !== null && !isAnalysisDocumentType(value.documentType)) return null;

  const blocks = parseList(value.blocks, parseBlock);
  if (!blocks) return null;

  return {
    v: 1,
    fingerprint: value.fingerprint,
    schemaVersion: value.schemaVersion as number,
    pipelineVersion: value.pipelineVersion as number,
    models: { block: value.models.block, merge: value.models.merge },
    documentType: value.documentType as AnalysisDocumentType | null,
    blocksTotal: value.blocksTotal as number,
    blocksTotalBeforeCap: value.blocksTotalBeforeCap as number,
    truncated: value.truncated,
    blocks,
    synthesis: value.synthesis as string | null,
    mergeDone: value.mergeDone,
    updatedAt: value.updatedAt,
  };
}
