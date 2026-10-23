"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { getDocumentById, listAssetLinkedFields } from "@/domain/documents/repository";
import type { LinkedDocumentFields } from "@/domain/assets/link-proposal";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listFieldVocabulary, type FieldVocabularyEntry } from "@/domain/structured-fields/vocabulary";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import { listProposalRejections } from "@/domain/proposals/repository";
import { listDocumentReminderDates } from "@/domain/reminders/repository";
import { listTypeCategoryOverrides } from "@/domain/categories/type-categories";
import type { TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import type { ProposalRejection } from "@/domain/proposals/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import { errorMessage } from "@/lib/utils";

/**
 * Tutto ciò che la scheda di un contenuto legge dal database, con il modo di ricaricarlo (`refresh`) e l'errore
 * condiviso: chi agisce sulla pagina (salva, accetta, elimina...) lo scrive con `setError`, e ogni ricarica lo azzera.
 */
export function useDocumentData(masterKey: CryptoKey, documentId: string) {
  const supabase = useSupabase();

  const [doc, setDoc] = useState<DocumentListItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Proposte: i rifiuti già espressi e i documenti già collegati a un bene, con i loro campi (da qui si propone il bene di questo documento).
  const [rejections, setRejections] = useState<ProposalRejection[]>([]);
  const [linkedFields, setLinkedFields] = useState<LinkedDocumentFields[]>([]);
  // Le scadenze già collegate a questo documento (solo i giorni): un evento letto che c'è già non si ripropone.
  const [reminderDates, setReminderDates] = useState<string[]>([]);
  const [typeCategories, setTypeCategories] = useState<TypeCategoryOverrides>({});
  // Etichette dei campi eterogenei già registrati (v. domain/structured-fields) --- per mostrare "Numero polizza" e non la chiave grezza in Scheda.
  const [fieldVocabulary, setFieldVocabulary] = useState<FieldVocabularyEntry[]>([]);

  // Contatore di richieste --- v. EditArchiveItemForm (StrictMode invoca l'effetto due volte al mount).
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [
        found,
        assetsResult,
        categoriesResult,
        dossiersResult,
        rejectionsResult,
        vocabularyResult,
        reminderDatesResult,
        typeCategoriesResult,
        linkedFieldsResult,
      ] = await Promise.all([
          getDocumentById(supabase, masterKey, documentId),
          listAssets(supabase, masterKey),
          listCategories(supabase),
          listDossiers(supabase, masterKey),
          listProposalRejections(supabase, masterKey, documentId),
          listFieldVocabulary(supabase),
          listDocumentReminderDates(supabase, documentId),
          // Una preferenza, non un dato della pagina: se non si legge (tabella non ancora presente) valgono le predefinite.
          listTypeCategoryOverrides(supabase).catch((): TypeCategoryOverrides => ({})),
          // Un suggerimento in più: se non si legge, la pagina funziona lo stesso, solo senza la proposta del bene.
          listAssetLinkedFields(supabase, masterKey, documentId).catch((): LinkedDocumentFields[] => []),
        ]);
      if (requestId !== latestRequestRef.current) return;
      setDoc(found);
      setAssets(assetsResult);
      setCategories(categoriesResult);
      setDossiers(dossiersResult);
      setRejections(rejectionsResult);
      setFieldVocabulary(vocabularyResult);
      setReminderDates(reminderDatesResult);
      setTypeCategories(typeCategoriesResult);
      setLinkedFields(linkedFieldsResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(errorMessage(err, "Impossibile caricare il contenuto."));
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, documentId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return {
    doc,
    categories,
    assets,
    dossiers,
    rejections,
    linkedFields,
    reminderDates,
    typeCategories,
    fieldVocabulary,
    loading,
    error,
    setError,
    refresh,
  };
}

export type DocumentData = ReturnType<typeof useDocumentData>;
