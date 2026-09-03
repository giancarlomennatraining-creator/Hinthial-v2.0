"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { fetchListViewPreferences, updateListViewPreferences } from "@/domain/profile/repository";
import {
  DEFAULT_LIST_VIEW_MODE,
  type ListSection,
  type ListViewMode,
  type ListViewPreferences,
} from "@/lib/list-view";

interface ListViewPreferencesContextValue {
  loading: boolean;
  modeFor: (section: ListSection) => ListViewMode;
  setMode: (section: ListSection, mode: ListViewMode) => Promise<void>;
}

const ListViewPreferencesContext = createContext<ListViewPreferencesContextValue | null>(null);

/**
 * Modalità di visualizzazione (elenco/tabella) per ogni sezione con
 * liste --- caricata una volta e condivisa da qui, così Impostazioni >
 * Aspetto e l'interruttore rapido in ogni sezione (v. ListViewToggle)
 * restano sempre sincronizzati senza dover ricaricare la pagina.
 * Sincronizzata sul server (profiles.list_view_preferences), non solo
 * su questo dispositivo --- a differenza del tema chiaro/scuro.
 */
export function ListViewPreferencesProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] = useState<ListViewPreferences>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const result = await fetchListViewPreferences(supabase, userId);
        if (!cancelled) setPreferences(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const modeFor = useCallback(
    (section: ListSection) => preferences[section] ?? DEFAULT_LIST_VIEW_MODE,
    [preferences],
  );

  const setMode = useCallback(
    async (section: ListSection, mode: ListViewMode) => {
      const previous = preferences;
      const next = { ...preferences, [section]: mode };
      setPreferences(next); // optimistic: l'interruttore risponde subito

      try {
        const supabase = createClient();
        await updateListViewPreferences(supabase, userId, next);
      } catch (err) {
        setPreferences(previous); // il server non ha salvato: si torna indietro
        throw err;
      }
    },
    [preferences, userId],
  );

  const value = useMemo<ListViewPreferencesContextValue>(
    () => ({ loading, modeFor, setMode }),
    [loading, modeFor, setMode],
  );

  return (
    <ListViewPreferencesContext.Provider value={value}>{children}</ListViewPreferencesContext.Provider>
  );
}

export function useListViewPreferences(): ListViewPreferencesContextValue {
  const ctx = useContext(ListViewPreferencesContext);
  if (!ctx) {
    throw new Error("useListViewPreferences must be used within a ListViewPreferencesProvider");
  }
  return ctx;
}
