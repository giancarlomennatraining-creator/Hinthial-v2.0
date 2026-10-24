"use client";

import { useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import type { DossierData } from "@/components/dossiers/detail/useDossierData";

/** Il giro di ogni modifica a fasi, passi, persone e documenti attesi: occupato, esegui, ricarica, errore leggibile. */
export function useDossierItemsAction(data: DossierData) {
  const supabase = useSupabase();
  const { refresh, setError } = data;

  const [itemsBusy, setItemsBusy] = useState(false);

  async function runItemsAction(action: (userId: string) => Promise<void>, failure: string) {
    setItemsBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await action(user.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : failure);
    } finally {
      setItemsBusy(false);
    }
  }

  return { itemsBusy, runItemsAction };
}
