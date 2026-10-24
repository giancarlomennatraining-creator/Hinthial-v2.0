"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { replaceDocumentDossierLinks } from "@/domain/dossiers/repository";
import {
  documentSuggestionKey,
  loadDismissedSuggestions,
  saveDismissedSuggestions,
  suggestDocumentsForDossier,
} from "@/domain/dossiers/suggestions";
import { useToast } from "@/components/ui/ToastProvider";
import { errorMessage } from "@/lib/utils";
import type { DossierData } from "@/components/dossiers/detail/useDossierData";

/** I documenti che sembrano appartenere al fascicolo: da aggiungere o da scartare ("Non ora", che resta sul dispositivo). */
export function useDossierSuggestions(dossierId: string, data: DossierData) {
  const supabase = useSupabase();
  const showToast = useToast();
  const { dossier, documents, assets, refresh, setError } = data;

  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [suggestionBusy, setSuggestionBusy] = useState(false);

  useEffect(() => {
    // I "Non ora" stanno sul dispositivo: si leggono dopo il montaggio, lo storage non esiste sul server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissedSuggestions());
  }, []);

  const isClosed = dossier?.status === "closed";
  const candidates = isClosed ? [] : suggestDocumentsForDossier({ dossierId, documents, assets, dismissed });

  function handleDismissCandidate(documentId: string) {
    const next = new Set(dismissed).add(documentSuggestionKey(dossierId, documentId));
    setDismissed(next);
    saveDismissedSuggestions(next);
  }

  /** Aggiunge il documento al fascicolo, tenendo gli altri fascicoli in cui già sta. */
  async function handleAddCandidate(documentId: string) {
    const target = documents.find((d) => d.id === documentId);
    if (!target) return;
    setSuggestionBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await replaceDocumentDossierLinks(supabase, user.id, documentId, [...target.dossierIds, dossierId]);
      await refresh();
      showToast("Documento aggiunto al fascicolo.");
    } catch (err) {
      setError(errorMessage(err, "Impossibile aggiungere il documento."));
    } finally {
      setSuggestionBusy(false);
    }
  }

  return { candidates, suggestionBusy, handleDismissCandidate, handleAddCandidate };
}
