"use client";

import { useEffect, useState } from "react";

/**
 * Tiene un elemento montato per la durata di una transizione CSS di uscita, invece di smontarlo di scatto insieme
 * allo stato booleano che lo controlla. Il chiamante applica le classi in base a `entered` (due frame di distanza
 * dal mount, altrimenti il browser dipinge i due stati nello stesso frame e la transizione non parte). `mounted`
 * diventa `true` nello stesso render in cui `open` lo diventa (non un render dopo), altrimenti un effetto del
 * chiamante che dipende da `open` (es. focus su un campo appena aperto) troverebbe l'elemento non ancora nel DOM.
 * La rete di sicurezza nell'useEffect sotto è per un caso reale osservato: aprire il cassetto mobile mentre altri
 * componenti si montano al suo interno può far "perdere" a React l'aggiustamento fatto durante il render, con
 * `mounted` che torna `false` da solo. Il meccanismo esatto non è mai stato isolato, ma il correttivo (riafferma
 * `mounted = true` in un effetto separato) è stato verificato empiricamente contro quello scenario.
 */
export function useMountedTransition(
  open: boolean,
  durationMs: number,
): { mounted: boolean; entered: boolean } {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);
  // Il valore di `open` all'ultimo render, confrontato per accorgersi del cambiamento nello stesso render (pattern React per "adattare lo stato quando cambia una prop").
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }

  // Rete di sicurezza (v. commento della funzione): senza, un aggiustamento "perso" lascerebbe il cassetto invisibile per sempre.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rete di sicurezza per l'aggiustamento durante il render qui sopra, non deriva stato nuovo: si limita a riaffermarlo se per qualche motivo non ha "preso" (v. commento della funzione).
    if (open && !mounted) setMounted(true);
  }, [open, mounted]);

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
