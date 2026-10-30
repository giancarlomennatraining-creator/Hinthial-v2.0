"use client";

import { useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { setDossierSummary } from "@/domain/dossiers/repository";
import { buildSummaryRequest } from "@/domain/ai/dossier-summary";
import { requestDossierSummary } from "@/domain/dossiers/summary-client";
import { getDocumentsByIds } from "@/domain/documents/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import { errorMessage } from "@/lib/utils";
import type { DossierData } from "@/components/dossiers/detail/useDossierData";

/** Il riassunto del fascicolo scritto da Silva e le sintesi dei documenti che lo compongono. */
export function useDossierSummary(masterKey: CryptoKey, dossierId: string, data: DossierData) {
  const supabase = useSupabase();
  const { dossier, documents, refresh, setError } = data;

  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryNotice, setSummaryNotice] = useState<string | null>(null);
  const [readings, setReadings] = useState<DocumentListItem[] | null>(null);
  const [readingsBusy, setReadingsBusy] = useState(false);

  /**
   * Il riassunto: le sintesi dei documenti già letti partono verso Claude (il server ricontrolla i permessi) e il testo
   * che torna si salva cifrato nel fascicolo. Nessun documento viene riletto.
   */
  async function handleWriteSummary() {
    if (!dossier) return;
    setSummaryBusy(true);
    setSummaryNotice(null);
    setError(null);
    try {
      const readableIds = documents.filter((d) => d.dossierIds.includes(dossierId) && d.aiSynthesisGeneratedAt !== null).map((d) => d.id);
      const request = buildSummaryRequest(dossier.title, await getDocumentsByIds(supabase, masterKey, readableIds));
      if (request.documents.length === 0) throw new Error("Silva non ha ancora letto nessun documento di questo fascicolo.");
      const result = await requestDossierSummary(request);
      await setDossierSummary(supabase, masterKey, dossierId, {
        text: result.summary,
        generatedAt: new Date().toISOString(),
        documentCount: result.used,
        readableCount: readableIds.length,
      });
      if (result.skipped > 0) {
        setSummaryNotice(
          `${result.skipped} ${result.skipped === 1 ? "documento è rimasto fuori" : "documenti sono rimasti fuori"}: ${
            result.skipped === 1 ? "è escluso" : "sono esclusi"
          } dall'analisi o di una categoria non abilitata.`,
        );
      }
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Impossibile scrivere il riassunto."));
    } finally {
      setSummaryBusy(false);
    }
  }

  async function handleRemoveSummary() {
    setSummaryBusy(true);
    setError(null);
    try {
      await setDossierSummary(supabase, masterKey, dossierId, null);
      setSummaryNotice(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Impossibile eliminare il riassunto."));
    } finally {
      setSummaryBusy(false);
    }
  }

  /** Le sintesi sono già nei documenti letti da Silva: si leggono solo quando le chiedi, e nessuna nuova lettura parte. */
  async function handleShowReadings(ids: string[]) {
    setReadingsBusy(true);
    setError(null);
    try {
      setReadings(await getDocumentsByIds(supabase, masterKey, ids));
    } catch (err) {
      setError(errorMessage(err, "Impossibile leggere i documenti."));
    } finally {
      setReadingsBusy(false);
    }
  }

  return {
    summaryBusy,
    summaryNotice,
    readings,
    readingsBusy,
    handleWriteSummary,
    handleRemoveSummary,
    handleShowReadings,
  };
}
