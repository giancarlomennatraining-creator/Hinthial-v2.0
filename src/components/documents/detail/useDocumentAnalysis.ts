"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  saveAISynthesis,
  saveContentAnalysis,
  updateDocumentAIExtractionExclusion,
} from "@/domain/documents/repository";
import { loadDocumentSegments } from "@/domain/documents/segments";
import type { ContentSegment } from "@/domain/extraction/types";
import { useDocumentSegments } from "@/components/documents/useDocumentSegments";
import { grantCategoryAIExtractionTemporarily } from "@/domain/categories/repository";
import {
  AnalysisAbortedError,
  analysisConfirmMessage,
  analyzeDocumentWithClaude,
  inspectSavedAnalysis,
  planAnalysis,
  type AIAnalysisScope,
  type AnalysisProgress,
  type SavedAnalysisState,
} from "@/domain/ai/analyze-document";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { errorMessage } from "@/lib/utils";
import type { DocumentData } from "@/components/documents/detail/useDocumentData";

/**
 * FASE 22: la lettura di Silva (Claude) di questo contenuto --- lo stato di quella già salvata, l'invio con la
 * conferma, l'avanzamento, l'interruzione. `onAnalyzed` scatta a lettura finita, per portare l'utente sul risultato.
 */
export function useDocumentAnalysis(masterKey: CryptoKey, data: DocumentData, onAnalyzed: () => void) {
  const supabase = useSupabase();
  const confirm = useConfirm();
  const { doc, categories, refresh, setError } = data;

  const [aiBusy, setAiBusy] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedAnalysisState>({ kind: "none" });
  const [aiProgress, setAiProgress] = useState<AnalysisProgress | null>(null);

  // Ciò che Silva ha già letto vale ancora per il testo di adesso? Serve a scegliere tra "chiedi", "riprendi" e "già letto".
  const savedAnalysisSource = doc?.contentAnalysis ?? null;
  const savedAnalysisText = doc?.extractedText ?? "";
  // Le pagine lette, se ci sono: l'impronta della lettura dipende dalla fonte (pagine o sezioni), quindi si aspetta che siano caricate.
  const { segments: pageSegments, ready: segmentsReady } = useDocumentSegments(supabase, masterKey, doc);
  useEffect(() => {
    if (!segmentsReady) return;
    let cancelled = false;
    inspectSavedAnalysis({ extractedText: savedAnalysisText, contentAnalysis: savedAnalysisSource }, masterKey, {
      segments: pageSegments,
    })
      .then((state) => {
        if (!cancelled) setSavedAnalysis(state);
      })
      .catch(() => {
        if (!cancelled) setSavedAnalysis({ kind: "none" });
      });
    return () => {
      cancelled = true;
    };
  }, [savedAnalysisSource, savedAnalysisText, masterKey, pageSegments, segmentsReady]);

  /** FASE 22: unica fase irreversibile del piano --- un contenuto uscito è uscito, quindi un window.confirm prima di ogni invio, qualunque sia lo scope scelto. */
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope, options?: { force?: boolean }) {
    if (!doc) return;
    const force = options?.force === true;
    // Le pagine e lo stato della lettura salvata si rileggono qui, non dallo stato: se il click arriva prima che il
    // caricamento finisca, uno stato ancora "none" farebbe ripartire (e pagare) una lettura già completa.
    let segments: ContentSegment[] | null;
    let saved: SavedAnalysisState;
    try {
      segments = await loadDocumentSegments(supabase, masterKey, doc).catch(() => null);
      saved = force ? { kind: "none" } : await inspectSavedAnalysis(doc, masterKey, { segments });
    } catch {
      return;
    }
    // Con una lettura già salvata che vale ancora, "Chiedi" riprende da dove era arrivata; "Rileggi da capo" riparte.
    if (saved.kind === "complete") return;
    if (
      !(await confirm({
        title: "Leggere con Silva?",
        message: analysisConfirmMessage(planAnalysis(doc, { segments }), saved),
        confirmLabel: "Invia a Silva",
      }))
    ) {
      return;
    }

    const abort = new AbortController();
    aiAbortRef.current = abort;
    setAiBusy(true);
    setError(null);
    try {
      if (scope === "temporary" && doc.categoryId) {
        await grantCategoryAIExtractionTemporarily(supabase, doc.categoryId, 30);
        await refresh();
      }
      const extracted = await analyzeDocumentWithClaude(doc, categories, scope, {
        segments,
        onProgress: setAiProgress,
        signal: abort.signal,
        force,
        reread: doc.aiSynthesisGeneratedAt !== null,
        persistence: {
          masterKey,
          saved: doc.contentAnalysis,
          save: (analysis, status) => saveContentAnalysis(supabase, masterKey, doc.id, analysis, status),
        },
      });
      if (extracted.synthesis) {
        // Non è una proposta: sostituisce sempre l'ultima lettura, come extractedText/Rileggi per il testo locale.
        await saveAISynthesis(supabase, masterKey, doc.id, extracted.synthesis);
      }
      await refresh();
      // Senza, l'utente non si accorgerebbe che qualcosa è successo: niente più tab "Proposte" a sé, quello che
      // Silva ha trovato vive già in "Chiedi a Silva".
      onAnalyzed();
    } catch (err) {
      // refresh() azzera l'errore, quindi prima si rilegge ciò che è stato salvato, poi si mostra l'errore.
      await refresh();
      // Interrompere non è un guasto: ciò che era già stato letto è salvato e il bottone propone di riprendere.
      if (!(err instanceof AnalysisAbortedError)) {
        setError(errorMessage(err, "Impossibile analizzare il documento con Silva."));
      }
    } finally {
      aiAbortRef.current = null;
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function handleToggleAIExclusion(next: boolean) {
    if (!doc) return;
    setError(null);
    try {
      await updateDocumentAIExtractionExclusion(supabase, doc.id, next);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Impossibile salvare l'esclusione."));
    }
  }

  return {
    aiBusy,
    aiProgress,
    savedAnalysis,
    pageSegments,
    handleAnalyzeWithClaude,
    handleAbort: () => aiAbortRef.current?.abort(),
    handleToggleAIExclusion,
  };
}
