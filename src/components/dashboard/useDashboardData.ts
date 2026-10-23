"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { buildSummaryContext } from "@/domain/ai/context";
import type { SummaryContext } from "@/domain/ai/types";
import { errorMessage } from "@/lib/utils";

/**
 * I dati della dashboard: un unico SummaryContext (v. domain/ai/context.ts), lo stesso snapshot già decifrato di
 * Assistente AI e ricerca globale, costruito una sola volta invece che con una query per widget.
 */
export function useDashboardData(masterKey: CryptoKey) {
  const supabase = useSupabase();
  const [context, setContext] = useState<SummaryContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setContext(await buildSummaryContext(supabase, masterKey));
    } catch (err) {
      setError(errorMessage(err, "Impossibile caricare la dashboard."));
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { context, loading, error };
}
