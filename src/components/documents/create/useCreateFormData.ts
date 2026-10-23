"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";

/**
 * Ciò che serve a compilare i dettagli (categorie, beni, fascicoli) e l'errore condiviso del form: chi agisce sulla
 * pagina lo scrive con `setError`, e ogni ricarica lo azzera.
 */
export function useCreateFormData(masterKey: CryptoKey) {
  const supabase = useSupabase();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, dossiersResult] =
        await Promise.all([
          listCategories(supabase),
          listAssets(supabase, masterKey),
          listDossiers(supabase, masterKey),
        ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDossiers(dossiersResult);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile caricare i dati necessari.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { categories, assets, dossiers, loading, error, setError };
}
