"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { fetchListViewPreferences, updateListViewPreferences } from "@/domain/profile/repository";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  DEFAULT_LIST_VIEW_MODE,
  type ArchiveViewMode,
  type ListSection,
  type ListViewMode,
  type ListViewPreferences,
} from "@/lib/list-view";

interface ListViewPreferencesContextValue {
  loading: boolean;
  /** Elenco o tabella. Per l'Archivio, che ha altre viste, è "table" solo se è quella scelta: le altre viste ricadono sull'elenco. */
  modeFor: (section: ListSection) => ListViewMode;
  setMode: (section: ListSection, mode: ListViewMode) => Promise<void>;
  /** La vista predefinita dell'Archivio (una delle sei). Sotto md è sempre l'elenco: le viste larghe non ci stanno. */
  archiveViewFor: () => ArchiveViewMode;
  /** La preferenza salvata, senza la regola dello schermo stretto: serve a Impostazioni, dove va sempre impostabile. */
  savedArchiveView: ArchiveViewMode;
  setArchiveView: (view: ArchiveViewMode) => Promise<void>;
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
  // Sotto md la tabella impaginata non ha spazio per restare leggibile
  // (v. richiesta utente) --- si mostra sempre l'elenco lì, a prescindere
  // dalla preferenza salvata (che resta comunque intatta e si applica di
  // nuovo su uno schermo più largo).
  const isNarrowScreen = useMediaQuery("(max-width: 767px)");

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
    (section: ListSection): ListViewMode => {
      if (isNarrowScreen) return "list";
      if (section === "archive") return preferences.archive === "table" ? "table" : "list";
      return preferences[section] ?? DEFAULT_LIST_VIEW_MODE;
    },
    [preferences, isNarrowScreen],
  );

  const savePreferences = useCallback(
    async (next: ListViewPreferences) => {
      const previous = preferences;
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

  const setMode = useCallback(
    (section: ListSection, mode: ListViewMode) => savePreferences({ ...preferences, [section]: mode }),
    [preferences, savePreferences],
  );

  const savedArchiveView: ArchiveViewMode = preferences.archive ?? DEFAULT_LIST_VIEW_MODE;
  const archiveViewFor = useCallback(
    (): ArchiveViewMode => (isNarrowScreen ? "list" : savedArchiveView),
    [isNarrowScreen, savedArchiveView],
  );
  const setArchiveView = useCallback(
    (view: ArchiveViewMode) => savePreferences({ ...preferences, archive: view }),
    [preferences, savePreferences],
  );

  const value = useMemo<ListViewPreferencesContextValue>(
    () => ({ loading, modeFor, setMode, archiveViewFor, savedArchiveView, setArchiveView }),
    [loading, modeFor, setMode, archiveViewFor, savedArchiveView, setArchiveView],
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
