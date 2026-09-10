"use client";

import { useEffect, useState } from "react";

/**
 * Tiene un elemento montato per la durata di una transizione CSS di
 * uscita, invece di smontarlo di scatto insieme allo stato booleano che
 * lo controlla --- altrimenti React lo toglierebbe dal DOM nello stesso
 * istante in cui la transizione dovrebbe iniziare, e non se ne vedrebbe
 * mai l'animazione (v. richiesta utente: entrata/uscita fluida per menu
 * mobile, pannelli laterali, popup).
 *
 * Il chiamante applica le proprie classi in base a `entered` (true =
 * stato visivo "aperto", false = "chiuso") --- due frame di distanza tra
 * il mount e il passaggio a `entered: true`, altrimenti il browser può
 * dipingere i due stati nello stesso frame e la transizione non parte
 * mai. `mounted` dice se renderizzare l'elemento nel DOM: diventa `true`
 * nello stesso render in cui `open` lo diventa (non un render dopo,
 * tramite un effetto) --- altrimenti un effetto del chiamante che
 * dipende a sua volta da `open` (es. dare il focus a un campo appena
 * aperto) troverebbe l'elemento non ancora nel DOM.
 */
export function useMountedTransition(
  open: boolean,
  durationMs: number,
): { mounted: boolean; entered: boolean } {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);
  // Il valore di `open` all'ultimo render --- confrontato (non letto da
  // un ref, mai durante il render) per accorgersi del cambiamento nello
  // stesso render in cui avviene, pattern documentato da React stesso
  // per "adattare lo stato quando cambia una prop".
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }

  useEffect(() => {
    let raf1: number;
    let raf2: number;
    let timeout: ReturnType<typeof setTimeout>;

    if (open) {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setEntered(true));
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizza lo stato visivo con la prop `open`, non deriva stato da altro stato/props durante il render (v. useMountedTransition sopra per la parte che invece può avvenire durante il render).
      setEntered(false);
      timeout = setTimeout(() => setMounted(false), durationMs);
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(timeout);
    };
  }, [open, durationMs]);

  return { mounted, entered };
}
