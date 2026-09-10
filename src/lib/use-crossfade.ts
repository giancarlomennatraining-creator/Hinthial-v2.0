"use client";

import { useEffect, useState } from "react";

/**
 * Dissolvenza in-out quando `value` cambia (es. la scheda attiva in
 * Impostazioni, v. richiesta utente) --- non un mount/unmount come
 * useMountedTransition, qui il contenuto sostituito è sempre presente,
 * solo diverso: si dissolve quello vecchio, POI si scambia il
 * contenuto, POI si dissolve dentro quello nuovo. `value` deve essere
 * confrontabile con `===` (una stringa/id va bene, un oggetto no).
 *
 * Due effetti separati apposta, non uno solo: mettere lo scambio di
 * `displayed` E la programmazione del fade-in nello stesso effetto crea
 * un bug --- l'aggiornamento di `displayed` fa ripartire quell'effetto
 * (è tra le sue dipendenze), la cui pulizia annulla il frame appena
 * programmato un istante prima, e il contenuto resta invisibile per
 * sempre dopo il primo cambio. Qui il primo effetto si occupa solo di
 * "aspetta, poi scambia il contenuto"; il secondo, con la propria
 * pulizia indipendente, si occupa solo di "una volta scambiato, dissolvi
 * dentro".
 */
export function useCrossfade<T>(value: T, durationMs: number): { displayed: T; visible: boolean } {
  const [displayed, setDisplayed] = useState(value);
  const [visible, setVisible] = useState(true);

  // 1. Quando `value` cambia: dissolvi fuori, poi (dopo la durata) scambia il contenuto mostrato.
  useEffect(() => {
    if (value === displayed) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- avvia la dissolvenza in uscita in risposta a `value` che cambia, non deriva stato da altro stato/props durante il render.
    setVisible(false);
    const timeout = setTimeout(() => setDisplayed(value), durationMs);

    return () => clearTimeout(timeout);
  }, [value, displayed, durationMs]);

  // 2. Una volta che il contenuto mostrato è quello giusto (ma ancora
  // invisibile): dissolvi dentro --- due frame di distanza, altrimenti il
  // browser può dipingere "scambiato ma già opaco" in un solo frame e la
  // dissolvenza non si vede.
  useEffect(() => {
    if (value !== displayed || visible) return;

    let raf2: number;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setVisible(true));
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [value, displayed, visible]);

  return { displayed, visible };
}
