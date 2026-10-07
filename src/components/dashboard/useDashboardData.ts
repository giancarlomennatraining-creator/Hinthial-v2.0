"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildSummaryContext } from "@/domain/ai/context";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";

/**
 * I dati della dashboard, uguali per ogni stile: un unico SummaryContext (v. domain/ai/context.ts), lo stesso snapshot
 * già decifrato di Assistente AI e ricerca globale, costruito una sola volta invece che con una query per widget.
 * Gli stili cambiano solo il modo di leggerlo. `patchReminder` aggiorna una scadenza in locale, dopo che il server ha
 * già salvato (o in modo ottimistico): evita di ricostruire e decifrare tutto per un "segna fatta".
 */
export function useDashboardData(masterKey: CryptoKey) {
  const [supabase] = useState(() => createClient());
  const [context, setContext] = useState<SummaryContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setContext(await buildSummaryContext(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare la dashboard.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const patchReminder = useCallback((id: string, patch: Partial<ReminderListItem>) => {
    setContext((prev) =>
      prev ? { ...prev, reminders: prev.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : prev,
    );
  }, []);

  return { supabase, context, loading, error, patchReminder };
}
