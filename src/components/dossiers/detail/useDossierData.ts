"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  listDossierItems,
  listDossiers,
  listExpectedItems,
  type DossierItems,
} from "@/domain/dossiers/repository";
import type { ExpectedItem } from "@/domain/dossiers/expected";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listReminders } from "@/domain/reminders/repository";
import type { AssetListItem } from "@/domain/assets/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import { errorMessage } from "@/lib/utils";

/**
 * Tutto ciò che la scheda di un fascicolo legge dal database, con il modo di ricaricarlo (`refresh`) e l'errore
 * condiviso: chi agisce sulla pagina lo scrive con `setError`, e ogni ricarica lo azzera.
 */
export function useDossierData(masterKey: CryptoKey, dossierId: string) {
  const supabase = useSupabase();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [now] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // null = la tabella non c'è ancora (migrazione non applicata): il riquadro non compare.
  const [expectedItems, setExpectedItems] = useState<ExpectedItem[] | null>(null);
  const [items, setItems] = useState<DossierItems | null>(null);

  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [dossiers, documentsResult, assetsResult, remindersResult, expectedResult, itemsResult] = await Promise.all([
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        listAssets(supabase, masterKey),
        // Un di più: se le scadenze non si leggono, la scheda mostra comunque i documenti.
        listReminders(supabase, masterKey).catch((): ReminderListItem[] => []),
        listExpectedItems(supabase, masterKey, dossierId).catch((): null => null),
        listDossierItems(supabase, masterKey, dossierId).catch((): null => null),
      ]);
      if (requestId !== latestRequestRef.current) return;
      setExpectedItems(expectedResult);
      setItems(itemsResult);
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
      setDocuments(documentsResult);
      setAssets(assetsResult);
      setReminders(remindersResult);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(errorMessage(err, "Impossibile caricare il fascicolo."));
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return {
    dossier,
    setDossier,
    documents,
    assets,
    reminders,
    now,
    loading,
    error,
    setError,
    expectedItems,
    setExpectedItems,
    items,
    setItems,
    refresh,
  };
}

export type DossierData = ReturnType<typeof useDossierData>;
