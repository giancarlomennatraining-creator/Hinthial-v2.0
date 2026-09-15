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
 *
 * La rete di sicurezza nell'useEffect qui sotto (non solo l'aggiustamento
 * durante il render) --- diagnosticato con un caso reale: aprire il
 * cassetto di navigazione (v. MobileNavBar) mentre, nello stesso istante,
 * altri componenti si montano per la prima volta al suo interno (la
 * ricerca globale, l'indicatore Onboarding) può far "perdere" a React
 * l'aggiustamento fatto durante il render --- `mounted` torna a `false`
 * senza che nulla chiami esplicitamente `setMounted(false)`, lasciando
 * il cassetto invisibile nonostante `open` sia `true` (v. segnalazione
 * utente: il tasto "non ha alcun effetto"). Non è mai stato possibile
 * risalire al meccanismo esatto internamente a React, ma il correttivo
 * qui sotto --- verificato empiricamente contro quello stesso scenario,
 * su una build di produzione pulita --- lo risolve: un effetto separato
 * riafferma `mounted = true` ogni volta che `open` è true ma `mounted`
 * non lo è ancora, indipendentemente dal percorso "durante il render"
 * qui sopra.
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

  // Rete di sicurezza --- v. commento sopra: senza, un aggiustamento
  // "perso" lascerebbe il cassetto invisibile per sempre (mai più
  // tentato, dato che open non cambia più da qui in avanti).
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
