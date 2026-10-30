"use client";

import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import { useAIProcessingConsent } from "@/components/ai/AIProcessingConsentProvider";
import { PastEventsNotice } from "@/components/documents/PastEventsNotice";
import { ReadingRegister } from "@/components/documents/ReadingRegister";
import { AIAnalysisTrigger } from "@/components/documents/AIAnalysisTrigger";
import { formatDate } from "@/lib/format";
import { PANEL_FLAT } from "@/components/ui/styles";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import type { ProposalRejection } from "@/domain/proposals/types";
import type { useDocumentAnalysis } from "@/components/documents/detail/useDocumentAnalysis";
import type { useDocumentProposals } from "@/components/documents/detail/useDocumentProposals";

/**
 * "Chiedi a Silva": il trigger (v. feedback utente: vive qui, non più fisso a sinistra, perché è sia dove si chiede
 * la lettura sia dove ne arriva il risultato), la sintesi e il registro di ciò che ha trovato.
 */
export function AnalysisPanel({
  doc,
  category,
  categories,
  assets,
  rejections,
  isPdf,
  analysis,
  proposals,
  loadPdfBytes,
}: {
  doc: DocumentListItem;
  category: Category | undefined;
  categories: Category[];
  assets: AssetListItem[];
  rejections: ProposalRejection[];
  isPdf: boolean;
  analysis: ReturnType<typeof useDocumentAnalysis>;
  proposals: ReturnType<typeof useDocumentProposals>;
  loadPdfBytes: () => Promise<Uint8Array>;
}) {
  const { masterEnabled, extractionConsent } = useAIProcessingConsent();
  const categoryEnabledForAI = category ? isCategoryEnabledForExtraction(category) : false;
  const { analysisOverview } = proposals;

  return (
    <div id="tabpanel-analysis" role="tabpanel" aria-labelledby="tab-analysis" className="flex flex-col gap-6">
      <AIAnalysisTrigger
        masterEnabled={masterEnabled}
        extractionConsent={extractionConsent}
        hasCategory={doc.categoryId !== null}
        categoryEnabled={categoryEnabledForAI}
        excluded={doc.aiExtractionExcluded}
        busy={analysis.aiBusy}
        progress={analysis.aiProgress}
        savedState={analysis.savedAnalysis}
        analyzedAtLabel={doc.analysisUpdatedAt ? formatDate(doc.analysisUpdatedAt) : null}
        documentTitle={doc.filename}
        lastRunFailed={doc.analysisStatus === "failed"}
        onAnalyze={analysis.handleAnalyzeWithClaude}
        onAbort={analysis.handleAbort}
        onToggleExcluded={analysis.handleToggleAIExclusion}
      />
      {doc.aiSynthesis ? (
        <section
          aria-label="Analisi con Silva"
          className={`${PANEL_FLAT} flex flex-col gap-3 p-4`}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- copia ridotta dell'avatar HINTHIA, v. public/brand/README.md */}
            <img src="/brand/hinthia/hinthia-64.png" alt="" className="h-5 w-5 shrink-0 rounded-full" />
            Analisi con Silva
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Generata da Silva
            </span>
          </h2>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{doc.aiSynthesis}</p>
          {doc.aiSynthesisGeneratedAt ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Letta il {formatDate(doc.aiSynthesisGeneratedAt)}. È un riassunto scritto da Silva, non una
              citazione del documento: può contenere imprecisioni.
            </p>
          ) : null}
        </section>
      ) : analysisOverview ? null : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Non hai ancora chiesto a Silva di leggere questo documento.
        </p>
      )}
      <ReadingRegister
        overview={analysisOverview}
        proposals={proposals.proposals}
        rejections={rejections}
        categories={categories}
        assets={assets}
        today={proposals.today}
        busy={proposals.proposalBusy}
        segments={analysis.pageSegments}
        text={doc.extractedText}
        loadPdfBytes={isPdf ? loadPdfBytes : undefined}
        onAccept={proposals.handleAcceptProposal}
        onReject={proposals.handleRejectProposal}
        onRestore={proposals.handleRestoreRejection}
        acceptAllCount={proposals.acceptAllCandidates.length}
        onAcceptAll={() => proposals.handleAcceptAll(proposals.acceptAllCandidates)}
      />
      <PastEventsNotice events={proposals.pastEvents} />
    </div>
  );
}
