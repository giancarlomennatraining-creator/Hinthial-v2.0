"use client";

import { useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  getDocumentById,
  saveAISynthesis,
  saveContentAnalysis,
  updateDocumentAIExtractionExclusion,
} from "@/domain/documents/repository";
import { grantCategoryAIExtractionTemporarily } from "@/domain/categories/repository";
import { isCategoryEnabledForExtraction } from "@/domain/categories/ai-consent";
import type { ContentSegment } from "@/domain/extraction/types";
import { loadDocumentSegments } from "@/domain/documents/segments";
import { useDocumentSegments } from "@/components/documents/useDocumentSegments";
import { readingStateFor } from "@/domain/extraction/reading-state";
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
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * Concept D: dopo il salvataggio, il documento appena creato e i passi su cosa farne --- invece del ritorno diretto
 * all'archivio. `savedDoc` è `null` finché il form è ancora in corso.
 */
export function usePostSave(
  masterKey: CryptoKey,
  categories: Category[],
  setError: (message: string | null) => void,
) {
  const supabase = useSupabase();
  const confirm = useConfirm();

  const [savedDoc, setSavedDoc] = useState<DocumentListItem | null>(null);
  const [savedMoment, setSavedMoment] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<AnalysisProgress | null>(null);
  const [aiDone, setAiDone] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<SavedAnalysisState>({ kind: "none" });

  const savedAnalysisSource = savedDoc?.contentAnalysis ?? null;
  const savedAnalysisText = savedDoc?.extractedText ?? "";
  const { segments: pageSegments, ready: segmentsReady } = useDocumentSegments(supabase, masterKey, savedDoc);
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

  // Il momento "salvato" dura un istante, poi si apre "Lettura dal dispositivo".
  useEffect(() => {
    if (!savedMoment) return;
    const id = setTimeout(() => setSavedMoment(false), 1800);
    return () => clearTimeout(id);
  }, [savedMoment]);

  /** Il contenuto è salvato: si mostrano i passi di dopo. */
  function markSaved(created: DocumentListItem) {
    setSavedDoc(created);
    setSavedMoment(true);
  }

  /** Stesso principio di ArchiveItemDetail.handleAnalyzeWithClaude --- qui basta la sintesi: le proposte si accettano sulla scheda, non qui. */
  async function handleAnalyzeWithClaude(scope: AIAnalysisScope, options?: { force?: boolean }) {
    if (!savedDoc) return;
    const force = options?.force === true;
    // Lettura salvata e pagine si rileggono qui, non dallo stato: v. ArchiveItemDetail.handleAnalyzeWithClaude.
    let segments: ContentSegment[] | null;
    let saved: SavedAnalysisState;
    try {
      segments = await loadDocumentSegments(supabase, masterKey, savedDoc).catch(() => null);
      saved = force ? { kind: "none" } : await inspectSavedAnalysis(savedDoc, masterKey, { segments });
    } catch {
      return;
    }
    if (saved.kind === "complete") return;
    if (
      !(await confirm({
        title: "Leggere con Hinthia?",
        message: analysisConfirmMessage(planAnalysis(savedDoc, { segments }), saved),
        confirmLabel: "Invia a Hinthia",
      }))
    ) {
      return;
    }

    const abort = new AbortController();
    aiAbortRef.current = abort;
    setAiBusy(true);
    setError(null);
    try {
      if (scope === "temporary" && savedDoc.categoryId) {
        await grantCategoryAIExtractionTemporarily(
          supabase,
          savedDoc.categoryId,
          30,
        );
      }
      const fields = await analyzeDocumentWithClaude(
        savedDoc,
        categories,
        scope,
        {
          segments,
          onProgress: setAiProgress,
          signal: abort.signal,
          force,
          persistence: {
            masterKey,
            saved: savedDoc.contentAnalysis,
            save: (analysis, status) => saveContentAnalysis(supabase, masterKey, savedDoc.id, analysis, status),
          },
        },
      );
      if (fields.synthesis) {
        await saveAISynthesis(
          supabase,
          masterKey,
          savedDoc.id,
          fields.synthesis,
        );
      }
      setSavedDoc((await getDocumentById(supabase, masterKey, savedDoc.id)) ?? savedDoc);
      setAiDone(true);
    } catch (err) {
      // Ciò che era già stato letto è salvato: si rilegge il documento perché il bottone proponga di riprendere.
      const reloaded = await getDocumentById(supabase, masterKey, savedDoc.id).catch(() => null);
      if (reloaded) setSavedDoc(reloaded);
      if (!(err instanceof AnalysisAbortedError)) {
        setError(
          err instanceof Error
            ? err.message
            : "Impossibile analizzare il documento con Hinthia.",
        );
      }
    } finally {
      aiAbortRef.current = null;
      setAiBusy(false);
      setAiProgress(null);
    }
  }

  async function handleToggleAIExclusion(next: boolean) {
    if (!savedDoc) return;
    setError(null);
    try {
      await updateDocumentAIExtractionExclusion(supabase, savedDoc.id, next);
      setSavedDoc((await getDocumentById(supabase, masterKey, savedDoc.id)) ?? savedDoc);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile salvare l'esclusione.",
      );
    }
  }

  // --- Dopo il salvataggio: i passi 4 e 5 nella stessa fisarmonica.
  const aiCategory = savedDoc
    ? categories.find((c) => c.id === savedDoc.categoryId)
    : undefined;
  const categoryEnabledForAI = aiCategory
    ? isCategoryEnabledForExtraction(aiCategory)
    : false;
  const readingState = savedDoc ? readingStateFor(savedDoc) : null;
  const step4Summary = savedDoc
    ? readingState === "text"
      ? `${savedDoc.extractedText.length.toLocaleString("it-IT")} caratteri letti`
      : "Fatto"
    : "";

  return {
    savedDoc,
    savedMoment,
    aiBusy,
    aiProgress,
    aiDone,
    savedAnalysis,
    categoryEnabledForAI,
    readingState,
    step4Summary,
    markSaved,
    handleAnalyzeWithClaude,
    handleAbort: () => aiAbortRef.current?.abort(),
    handleToggleAIExclusion,
  };
}

export type PostSave = ReturnType<typeof usePostSave>;
