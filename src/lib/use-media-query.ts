"use client";

import { useEffect, useState } from "react";

/**
 * Legge una media query CSS lato client, aggiornandosi da sé se cambia
 * (ridimensionamento della finestra, rotazione dello schermo) --- stesso
 * meccanismo di ThemeToggle per "prefers-color-scheme", qui generalizzato
 * a qualunque query. Restituisce `false` al primo render (prima che
 * l'effetto legga il valore vero): va bene per una preferenza che ha già
 * un proprio breve stato di caricamento (v. ListViewPreferencesProvider),
 * non per una che deciderebbe da sola il layout della shell al primo
 * paint (v. invece NavOrientationProvider, valore letto lato server).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legge lo stato attuale della media query al mount, non deriva stato da props/state React.
    setMatches(media.matches);

    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
