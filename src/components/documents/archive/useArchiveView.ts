"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { useMediaQuery } from "@/lib/use-media-query";
import { isArchiveViewMode, type ArchiveViewMode } from "@/lib/list-view";

/** Nome del parametro dell'indirizzo che sceglie la vista solo per questa visita (`/archive?vista=timeline`). */
export const ARCHIVE_VIEW_PARAM = "vista";

/**
 * La vista dell'Archivio che si sta guardando: quella dell'indirizzo se c'è (vale per questa visita, il tasto indietro
 * la riporta com'era), altrimenti quella predefinita scelta in Impostazioni. Sotto md è sempre l'elenco: le viste larghe
 * non ci stanno.
 */
export function useArchiveView() {
  const { archiveViewFor, savedArchiveView, setArchiveView, loading } = useListViewPreferences();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isNarrowScreen = useMediaQuery("(max-width: 767px)");

  const defaultView = archiveViewFor();
  const param = searchParams.get(ARCHIVE_VIEW_PARAM);
  const view: ArchiveViewMode = isNarrowScreen ? "list" : isArchiveViewMode(param) ? param : defaultView;

  const href = useCallback(
    (next: ArchiveViewMode | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null) params.delete(ARCHIVE_VIEW_PARAM);
      else params.set(ARCHIVE_VIEW_PARAM, next);
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const setView = useCallback(
    (next: ArchiveViewMode) => {
      router.push(href(next), { scroll: false });
    },
    [router, href],
  );

  /** Salva la vista attuale come predefinita e toglie il parametro: da qui in poi è quella di sempre. */
  const makeDefault = useCallback(async () => {
    await setArchiveView(view);
    router.replace(href(null), { scroll: false });
  }, [setArchiveView, view, router, href]);

  return {
    view,
    /** La predefinita per questo schermo (sotto md è sempre l'elenco). */
    defaultView,
    /** La preferenza salvata, anche se lo schermo è stretto. */
    savedView: savedArchiveView,
    setView,
    makeDefault,
    /** Le preferenze si caricano dal server: finché non ci sono non si sa quale vista mostrare. */
    preferencesLoading: loading && !isArchiveViewMode(param),
    isNarrowScreen,
  };
}
