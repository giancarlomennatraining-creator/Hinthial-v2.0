import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ContentSegment } from "@/domain/extraction/types";
import type { Proposal, ProposalRejection } from "@/domain/proposals/types";
import { prepareAnalysis } from "@/domain/ai/analysis/blocks";
import { mergeBlocks } from "@/domain/ai/analysis/merge";
import { parseBlockAnalysis } from "@/domain/ai/analysis/result";
import {
  isAnalysisDocumentType,
  resolveAnalysisSchema,
  type AnalysisDocumentType,
} from "@/domain/ai/analysis/schemas";
import {
  validateBlock,
  type ValidatedBlock,
  type ValidatedEvidence,
  type ValidatedField,
} from "@/domain/ai/analysis/validate";

/** FASE 22: con quale permesso si autorizza l'invio del testo a Claude --- v. AIAnalysisTrigger.tsx. */
export type AIAnalysisScope = "category" | "temporary" | "once";

/** Candidati validati --- stessa forma di StructuredField (domain/extraction/structured-fields.ts), ma da Claude, ognuno con la sua provenienza. */
export interface AIExtractedFields {
  /** Ogni voce ha `source` (la citazione, verificata) e `provenance` (il segmento, e la pagina se il documento ne ha). */
  expiry: ValidatedEvidence[];
  issuer: ValidatedEvidence[];
  category: ValidatedEvidence | null;
  /** Campi eterogeni aperti (numero polizza, targa, ...) --- chiave già normalizzata. */
  fields: ValidatedField[];
  /** Sintesi/descrizione in prosa --- derivata: è per natura una lettura d'insieme, non ha una citazione e non passa dalla verifica. null se non fornita. */
  synthesis: string | null;
  /** Il tipo che il modello ha riconosciuto, ricondotto al registro (sconosciuto = "generico"). */
  documentType: AnalysisDocumentType;
  /** Quanto del documento è stato letto: meno di `blocksTotal` se il tetto per documento ha lasciato fuori una parte. */
  coverage: { blocksAnalyzed: number; blocksTotal: number; truncated: boolean };
}

export interface AnalyzeOptions {
  /** I segmenti per pagina letti sul dispositivo, se disponibili: danno una provenienza per pagina. Senza, il testo si divide in sezioni. */
  segments?: ContentSegment[] | null;
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

export function planAnalysis(doc: Pick<DocumentListItem, "extractedText">, options?: AnalyzeOptions): AnalysisPlan {
  const prepared = prepareAnalysis({ segments: options?.segments, text: doc.extractedText });
  return { parts: prepared.blocks.length, truncated: prepared.truncated };
}

/** Il testo del window.confirm prima dell'invio: dice quanto lavoro parte, perché un contenuto uscito è uscito. */
export function analysisConfirmMessage(plan: AnalysisPlan): string {
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

async function postAnalyze(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

  reserveRequests(prepared.blocks.length + (prepared.blocks.length > 1 ? 1 : 0));

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  let documentType: AnalysisDocumentType | null = null;
  const validated: ValidatedBlock[] = [];

  for (const block of prepared.blocks) {
    const data = (await postAnalyze({
      mode: "block",
      documentId: doc.id,
      scope,
      categories: categoryOptions,
      documentType,
      block,
    })) as { result?: unknown } | null;

    const raw = parseBlockAnalysis(data?.result);
    if (!raw) throw new Error("Risposta di Hinthia non valida.");

    // Il tipo si decide al primo blocco e vale per i successivi: lo schema atteso non cambia a metà documento.
    documentType ??= isAnalysisDocumentType(raw.documentType) ? raw.documentType : "generico";
    validated.push(validateBlock(raw, prepared.segments, categories, resolveAnalysisSchema(documentType)));
  }

  const merged = mergeBlocks(validated);

  let synthesis: string | null = merged.partialSyntheses[0] ?? null;
  if (merged.partialSyntheses.length > 1) {
    try {
      const data = (await postAnalyze({
        mode: "merge",
        documentId: doc.id,
        scope,
        partials: merged.partialSyntheses,
      })) as { synthesis?: unknown } | null;
      synthesis =
        typeof data?.synthesis === "string" && data.synthesis.trim()
          ? data.synthesis.trim()
          : merged.partialSyntheses.join(" ");
    } catch {
      // La fusione è un di più: le letture con citazione sono già al sicuro, le sintesi parziali bastano.
      synthesis = merged.partialSyntheses.join(" ");
    }
  }

  return {
    expiry: merged.expiry,
    issuer: merged.issuer,
    category: merged.category,
    fields: merged.fields,
    synthesis,
    documentType: documentType ?? "generico",
    coverage: {
      blocksAnalyzed: prepared.blocks.length,
      blocksTotal: prepared.blocksTotal,
      truncated: prepared.truncated,
    },
  };
}

/**
 * Stessa logica di filtro di buildProposals (domain/proposals/build.ts) --- niente su campi già compilati, niente
 * già rifiutato, dedup --- ma sui candidati letti da Claude. Non riusa buildProposals: quello resta il percorso
 * locale, testato, invariato; questo è un percorso a parte per candidati con una provenienza diversa.
 */
export function buildAIProposals(
  doc: Pick<DocumentListItem, "expiresAt" | "issuer" | "categoryId" | "structuredFields">,
  fields: AIExtractedFields,
  rejections: ProposalRejection[],
): Proposal[] {
  const proposals: Proposal[] = [];

  if (!doc.expiresAt) {
    for (const f of fields.expiry) {
      proposals.push({ kind: "expiry", value: f.value, source: f.source, aiGenerated: true });
    }
  }

  if (!doc.categoryId && fields.category) {
    proposals.push({ kind: "category", value: fields.category.value, source: fields.category.source, aiGenerated: true });
  }

  if (!doc.issuer) {
    for (const f of fields.issuer) {
      proposals.push({ kind: "issuer", value: f.value, source: f.source, aiGenerated: true });
    }
  }

  for (const f of fields.fields) {
    if (doc.structuredFields[f.key]) continue; // già compilato: proporlo di nuovo significherebbe rimettere in discussione una scelta già fatta.
    proposals.push({
      kind: "field",
      value: f.value,
      source: f.source,
      aiGenerated: true,
      fieldKey: f.key,
      fieldLabel: f.label,
    });
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
