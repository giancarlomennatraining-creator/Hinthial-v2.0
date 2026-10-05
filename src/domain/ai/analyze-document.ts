import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ContentSegment } from "@/domain/extraction/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import { contentFingerprint } from "@/lib/crypto/fingerprint";
import { prepareAnalysis, type PreparedAnalysis } from "@/domain/ai/analysis/blocks";
import { defaultCategoryFor, type TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { mergeBlocks } from "@/domain/ai/analysis/merge";
import {
  statusOf,
  type AnalysisStatus,
  type PersistedContentAnalysis,
} from "@/domain/ai/analysis/persisted";
import {
  ANALYSIS_MODELS,
  ANALYSIS_PIPELINE_VERSION,
  ANALYSIS_SCHEMA_VERSION,
} from "@/domain/ai/analysis/pipeline";
import { parseBlockAnalysis } from "@/domain/ai/analysis/result";
import {
  isAnalysisDocumentType,
  resolveAnalysisSchema,
  type AnalysisDocumentType,
} from "@/domain/ai/analysis/schemas";
import {
  validateBlock,
  type ValidatedEvent,
  type ValidatedEvidence,
  type ValidatedField,
} from "@/domain/ai/analysis/validate";

/** FASE 22: con quale permesso si autorizza l'invio del testo a Claude --- v. AIAnalysisTrigger.tsx. */
export type AIAnalysisScope = "category" | "temporary" | "once";

/** Candidati validati letti da Claude, ognuno con la sua provenienza. */
export interface AIExtractedFields {
  /** Ogni voce ha `source` (la citazione, verificata) e `provenance` (il segmento, e la pagina se il documento ne ha). */
  expiry: ValidatedEvidence[];
  issuer: ValidatedEvidence[];
  category: ValidatedEvidence | null;
  /** Campi eterogeni aperti (numero polizza, targa, ...) --- chiave già normalizzata. */
  fields: ValidatedField[];
  /** Date da ricordare (pagamenti, rinnovi, appuntamenti): diventano proposte verso Scadenze. */
  events: ValidatedEvent[];
  /** Sintesi/descrizione in prosa --- derivata: è per natura una lettura d'insieme, non ha una citazione e non passa dalla verifica. null se non fornita. */
  synthesis: string | null;
  /** Il tipo che il modello ha riconosciuto, ricondotto al registro (sconosciuto = "generico"). */
  documentType: AnalysisDocumentType;
  /** Quanto del documento è stato letto: meno di `blocksTotal` se il tetto per documento ha lasciato fuori una parte. */
  coverage: { blocksAnalyzed: number; blocksTotal: number; truncated: boolean };
}

/** Dove è arrivata la lettura: `current` è la parte in corso (da 1), `total` il numero di parti; "merging" = sintesi finale. */
export interface AnalysisProgress {
  phase: "reading" | "merging";
  current: number;
  total: number;
}

/** Dove e con che chiave tenere la lettura: senza, l'analisi vive solo finché la pagina è aperta. */
export interface AnalysisPersistence {
  masterKey: CryptoKey;
  /** La lettura già salvata per questo documento, se c'è: se vale ancora si riprende da lì invece di ripartire. */
  saved: PersistedContentAnalysis | null;
  /** Chiamata dopo ogni blocco e a fine lettura: il lavoro già pagato non si perde se la pagina si chiude. */
  save: (analysis: PersistedContentAnalysis, status: AnalysisStatus) => Promise<void>;
}

export interface AnalyzeOptions {
  /** I segmenti per pagina letti sul dispositivo, se disponibili: danno una provenienza per pagina. Senza, il testo si divide in sezioni. */
  segments?: ContentSegment[] | null;
  /** Chiamata prima di ogni richiesta, così la pagina può mostrare a che punto è un documento lungo. */
  onProgress?: (progress: AnalysisProgress) => void;
  persistence?: AnalysisPersistence;
  /** Interrompe la lettura: ciò che è già stato letto resta salvato e si può riprendere. */
  signal?: AbortSignal;
  /** "Rileggi da capo": ignora la lettura salvata e rilegge tutto. */
  force?: boolean;
  /** Il documento era già stato letto da Hinthia prima di questa lettura: finisce così nella cronologia ("riletto" e non "letto"). */
  reread?: boolean;
}

/** Lanciato quando l'utente interrompe una lettura: non è un guasto, e ciò che è già stato letto resta salvato. */
export class AnalysisAbortedError extends Error {
  constructor() {
    super("Lettura interrotta.");
    this.name = "AnalysisAbortedError";
  }
}

/**
 * Tetto di costo per sessione (la pagina aperta): il lavoro grande non parte da solo, e dopo questo numero di richieste
 * serve ricaricare. Non è una sicurezza lato server --- è un freno contro un'analisi in serie lanciata per errore.
 */
export const MAX_REQUESTS_PER_SESSION = 100;
let requestsThisSession = 0;

/** Solo per i test. */
export function resetAnalysisSession() {
  requestsThisSession = 0;
}

function reserveRequests(count: number) {
  if (requestsThisSession + count > MAX_REQUESTS_PER_SESSION) {
    throw new Error(
      "Hai già fatto leggere molti documenti a Hinthia in questa sessione. Ricarica la pagina per continuare.",
    );
  }
  requestsThisSession += count;
}

export interface AnalysisPlan {
  /** In quante richieste a Hinthia si divide la lettura. */
  parts: number;
  truncated: boolean;
}

/** Che cosa c'è già di salvato per questo documento, rispetto a ciò che si leggerebbe adesso. */
export type SavedAnalysisState =
  | { kind: "none" }
  /** C'è una lettura, ma di un testo o di una versione della lettura diversi: ripartirebbe da capo. */
  | { kind: "stale" }
  /** Interrotta o fermata da un errore: riprende dalla parte `done + 1`. */
  | { kind: "interrupted"; done: number; total: number }
  /** Tutte le parti sono lette, manca solo la sintesi finale. */
  | { kind: "merge-pending" }
  | { kind: "complete" };

async function fingerprintOf(masterKey: CryptoKey, prepared: PreparedAnalysis): Promise<string> {
  return contentFingerprint(masterKey, [
    "analysis:v1",
    String(ANALYSIS_SCHEMA_VERSION),
    String(ANALYSIS_PIPELINE_VERSION),
    ANALYSIS_MODELS.block,
    ANALYSIS_MODELS.merge,
    JSON.stringify(prepared.blocks.map((block) => [block.id, block.text])),
  ]);
}

function savedStateOf(saved: PersistedContentAnalysis | null, fingerprint: string): SavedAnalysisState {
  if (!saved) return { kind: "none" };
  if (saved.fingerprint !== fingerprint) return { kind: "stale" };
  if (saved.blocks.length < saved.blocksTotal) {
    return { kind: "interrupted", done: saved.blocks.length, total: saved.blocksTotal };
  }
  return saved.mergeDone ? { kind: "complete" } : { kind: "merge-pending" };
}

/** Prima di chiedere conferma: la lettura salvata vale ancora? Se sì, quanto resta da fare (e se niente, non si spende niente). */
export async function inspectSavedAnalysis(
  doc: Pick<DocumentListItem, "extractedText" | "contentAnalysis">,
  masterKey: CryptoKey,
  options?: Pick<AnalyzeOptions, "segments">,
): Promise<SavedAnalysisState> {
  if (!doc.contentAnalysis) return { kind: "none" };
  const prepared = prepareAnalysis({ segments: options?.segments, text: doc.extractedText });
  return savedStateOf(doc.contentAnalysis, await fingerprintOf(masterKey, prepared));
}

/** I candidati di una lettura salvata, nella forma che la scheda sa già mostrare come proposte. */
export function extractedFieldsFrom(
  analysis: PersistedContentAnalysis,
  categories: { id: string; name?: string }[],
  /** Le scelte dell'utente su quale categoria proporre per tipo (v. Impostazioni > Categorie). */
  typeCategories?: TypeCategoryOverrides,
): AIExtractedFields {
  const merged = mergeBlocks(analysis.blocks);
  // Una categoria eliminata dopo la lettura non è più una proposta sensata.
  let category = merged.category && categories.some((c) => c.id === merged.category?.value) ? merged.category : null;

  // Se il motore non ha proposto una categoria, quella che di norma va con il tipo del documento (v. category-defaults.ts).
  if (!category) {
    const byType = defaultCategoryFor(analysis.documentType, categories, typeCategories);
    if (byType) {
      category = {
        derived: true,
        value: byType.id,
        source: `Dal tipo di documento: ${resolveAnalysisSchema(analysis.documentType).label}`,
        provenance: { segmentId: "tipo-documento", page: null },
      };
    }
  }
  return {
    expiry: merged.expiry,
    issuer: merged.issuer,
    category,
    fields: merged.fields,
    events: merged.events,
    synthesis: analysis.synthesis,
    documentType: analysis.documentType ?? "generico",
    coverage: {
      blocksAnalyzed: analysis.blocks.length,
      blocksTotal: analysis.blocksTotalBeforeCap,
      truncated: analysis.truncated,
    },
  };
}

export function planAnalysis(doc: Pick<DocumentListItem, "extractedText">, options?: AnalyzeOptions): AnalysisPlan {
  const prepared = prepareAnalysis({ segments: options?.segments, text: doc.extractedText });
  return { parts: prepared.blocks.length, truncated: prepared.truncated };
}

/** Il testo del window.confirm prima dell'invio: dice quanto lavoro parte, perché un contenuto uscito è uscito. */
export function analysisConfirmMessage(plan: AnalysisPlan, saved?: SavedAnalysisState): string {
  if (saved?.kind === "merge-pending") {
    return "Hinthia ha già letto tutte le parti: resta da preparare la sintesi finale, e verranno inviate solo le sintesi parziali. Continuare?";
  }
  if (saved?.kind === "interrupted") {
    const left = saved.total - saved.done;
    return `Hinthia aveva già letto ${saved.done} parti su ${saved.total}. Riprendo da dove si era fermata: il testo delle ${left} restanti verrà inviato a Hinthia. Continuare?`;
  }
  let message = "Il testo di questo documento verrà inviato a Hinthia";
  if (plan.parts > 1) message += ` in ${plan.parts} parti`;
  message += ". Continuare?";
  if (plan.truncated) {
    message += `\n\nIl documento è molto lungo: verranno lette solo le prime ${plan.parts} parti.`;
  } else if (plan.parts > 5) {
    message += "\n\nIl documento è lungo: la lettura richiederà un po' di tempo.";
  }
  return message;
}

async function postAnalyze(body: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error ?? "Impossibile analizzare il documento con Claude.");
  }
  return response.json();
}

/**
 * Chiede a Claude di leggere un documento, via la route server-side (mai dal browser): una richiesta per blocco, in
 * ordine, poi la fusione. Ogni lettura viene verificata qui contro i segmenti inviati --- il server non è la fonte
 * di verità. Lancia se il gate lato server rifiuta o se una risposta non è valida.
 */
export async function analyzeDocumentWithClaude(
  doc: Pick<DocumentListItem, "id" | "extractedText">,
  categories: Category[],
  scope: AIAnalysisScope,
  options?: AnalyzeOptions,
): Promise<AIExtractedFields> {
  const prepared = prepareAnalysis({ segments: options?.segments, text: doc.extractedText });
  if (prepared.blocks.length === 0) {
    throw new Error("Questo documento non ha testo da far leggere a Hinthia.");
  }

  const persistence = options?.persistence;
  const signal = options?.signal;
  const fingerprint = persistence ? await fingerprintOf(persistence.masterKey, prepared) : "";

  const reusable =
    persistence?.saved && !options?.force && savedStateOf(persistence.saved, fingerprint).kind !== "stale"
      ? persistence.saved
      : null;

  const state: PersistedContentAnalysis = reusable
    ? { ...reusable, blocks: [...reusable.blocks] }
    : {
        v: 1,
        fingerprint,
        schemaVersion: ANALYSIS_SCHEMA_VERSION,
        pipelineVersion: ANALYSIS_PIPELINE_VERSION,
        models: { block: ANALYSIS_MODELS.block, merge: ANALYSIS_MODELS.merge },
        documentType: null,
        blocksTotal: prepared.blocks.length,
        blocksTotalBeforeCap: prepared.blocksTotal,
        truncated: prepared.truncated,
        blocks: [],
        synthesis: null,
        mergeDone: false,
        updatedAt: new Date().toISOString(),
      };

  const total = prepared.blocks.length;
  // Una lettura già completa non spende niente: si riservano solo le richieste che restano.
  reserveRequests(total - state.blocks.length + (!state.mergeDone && total > 1 ? 1 : 0));

  const persist = async (status: AnalysisStatus) => {
    if (!persistence) return;
    state.updatedAt = new Date().toISOString();
    await persistence.save(state, status);
  };
  const abortIfRequested = async () => {
    if (!signal?.aborted) return;
    if (state.blocks.length > 0) await persist("pending");
    throw new AnalysisAbortedError();
  };

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  for (let index = state.blocks.length; index < total; index += 1) {
    await abortIfRequested();
    options?.onProgress?.({ phase: "reading", current: index + 1, total });
    try {
      const data = (await postAnalyze(
        {
          mode: "block",
          documentId: doc.id,
          scope,
          reread: options?.reread === true,
          categories: categoryOptions,
          documentType: state.documentType,
          block: prepared.blocks[index],
        },
        signal,
      )) as { result?: unknown } | null;

      const raw = parseBlockAnalysis(data?.result);
      if (!raw) throw new Error("Risposta di Hinthia non valida.");

      // Il tipo si decide al primo blocco e vale per i successivi: lo schema atteso non cambia a metà documento.
      state.documentType ??= isAnalysisDocumentType(raw.documentType) ? raw.documentType : "generico";
      state.blocks.push(validateBlock(raw, prepared.segments, categories, resolveAnalysisSchema(state.documentType)));
    } catch (error) {
      await abortIfRequested();
      if (state.blocks.length > 0) await persist("failed");
      throw error;
    }
    await persist("pending");
  }

  if (!state.mergeDone) {
    const merged = mergeBlocks(state.blocks);
    if (merged.partialSyntheses.length > 1) {
      await abortIfRequested();
      options?.onProgress?.({ phase: "merging", current: total, total });
      try {
        const data = (await postAnalyze(
          { mode: "merge", documentId: doc.id, scope, reread: options?.reread === true, partials: merged.partialSyntheses },
          signal,
        )) as { synthesis?: unknown } | null;
        state.synthesis =
          typeof data?.synthesis === "string" && data.synthesis.trim()
            ? data.synthesis.trim()
            : merged.partialSyntheses.join(" ");
        state.mergeDone = true;
      } catch {
        await abortIfRequested();
        // La fusione è un di più: le letture con citazione sono già al sicuro, le sintesi parziali bastano. Resta da
        // rifare solo questo passo (stato "partial"), non i blocchi.
        state.synthesis = merged.partialSyntheses.join(" ");
      }
    } else {
      state.synthesis = merged.partialSyntheses[0] ?? null;
      state.mergeDone = true;
    }
    await persist(statusOf(state));
  }

  return extractedFieldsFrom(state, categories);
}

/** La pagina di una lettura, se il documento è stato letto per pagine: per le sezioni non c'è nulla da dire. */
function pageOf(evidence: { provenance: { page: number | null } }): { page?: number } {
  return evidence.provenance.page === null ? {} : { page: evidence.provenance.page };
}

/**
 * Le date da ricordare che la lettura ha trovato ma che sono già passate: `buildAIProposals` non le propone, e la scheda
 * lo dice invece di lasciarle sparire. Una per giorno, dalla più vecchia.
 */
export function pastEventsOf(fields: Pick<AIExtractedFields, "events">, today: string): { date: string; title: string }[] {
  const byDate = new Map<string, string>();
  for (const event of fields.events) {
    if (event.value < today && !byDate.has(event.value)) byDate.set(event.value, event.title);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, title]) => ({ date, title }));
}

/** Ciò che serve a decidere quali eventi proporre: senza, gli eventi non si propongono (non si sa cosa c'è già in Scadenze). */
export interface EventProposalContext {
  /** Oggi, `YYYY-MM-DD` nel fuso dell'utente. */
  today: string;
  /** Le date (`YYYY-MM-DD`, fuso dell'utente) delle scadenze già collegate a questo documento. */
  existingDates: string[];
}

/**
 * Le proposte dai candidati letti da Claude: niente su campi già compilati, niente già rifiutato, dedup.
 */
export function buildAIProposals(
  doc: Pick<DocumentListItem, "expiresAt" | "issuer" | "categoryId" | "structuredFields">,
  fields: AIExtractedFields,
  rejections: ProposalRejection[],
  events?: EventProposalContext,
): Proposal[] {
  const proposals: Proposal[] = [];

  if (!doc.expiresAt) {
    for (const f of fields.expiry) {
      proposals.push({ kind: "expiry", value: f.value, source: f.source, ...pageOf(f), aiGenerated: true });
    }
  }

  if (!doc.categoryId && fields.category) {
    proposals.push({
      kind: "category",
      value: fields.category.value,
      source: fields.category.source,
      ...pageOf(fields.category),
      aiGenerated: true,
      ...(fields.category.derived ? { derived: true } : {}),
    });
  }

  if (!doc.issuer) {
    for (const f of fields.issuer) {
      proposals.push({ kind: "issuer", value: f.value, source: f.source, ...pageOf(f), aiGenerated: true });
    }
  }

  for (const f of fields.fields) {
    if (doc.structuredFields[f.key]) continue; // già compilato: proporlo di nuovo significherebbe rimettere in discussione una scelta già fatta.
    proposals.push({
      kind: "field",
      value: f.value,
      source: f.source,
      ...pageOf(f),
      aiGenerated: true,
      fieldKey: f.key,
      fieldLabel: f.label,
    });
  }

  if (events) {
    for (const f of fields.events) {
      // Una data passata non è più una scadenza da ricordare; una già in Scadenze per questo documento è già stata raccolta.
      if (f.value < events.today || events.existingDates.includes(f.value)) continue;
      proposals.push({ kind: "event", value: f.value, source: f.source, ...pageOf(f), aiGenerated: true, eventTitle: f.title });
    }
  }

  const deduped = proposals.filter(
    (proposal, index) =>
      !proposals
        .slice(0, index)
        .some((p) => p.kind === proposal.kind && p.value === proposal.value && p.fieldKey === proposal.fieldKey),
  );

  return deduped.filter(
    (proposal) =>
      !rejections.some(
        (r) => r.kind === proposal.kind && r.value === proposal.value && r.fieldKey === proposal.fieldKey,
      ),
  );
}
