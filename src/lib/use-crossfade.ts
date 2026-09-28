"use client";

import { useEffect, useState } from "react";

/**
 * Dissolvenza in-out quando `value` cambia: a differenza di useMountedTransition il contenuto sostituito è sempre
 * presente, solo diverso, si dissolve quello vecchio, POI si scambia, POI si dissolve dentro quello nuovo. `value`
 * deve essere confrontabile con `===`. Due effetti separati apposta: mettere lo scambio di `displayed` e la
 * programmazione del fade-in nello stesso effetto crea un bug, perché l'aggiornamento di `displayed` fa ripartire
 * quell'effetto e la sua pulizia annulla il frame appena programmato, lasciando il contenuto invisibile per sempre.
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

  // 2. Contenuto mostrato giusto ma ancora invisibile: dissolvi dentro, due frame di distanza altrimenti il browser dipinge "scambiato ma già opaco" in un solo frame.
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
