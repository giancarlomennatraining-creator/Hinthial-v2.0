"use client";

import { useEffect, useState } from "react";

/**
 * Un solo `setInterval` al secondo condiviso da ogni CapsuleCountdown
 * montato nella pagina, invece di uno per riga --- con più capsule
 * chiuse insieme in elenco/tabella, un timer a testa sommerebbe lavoro
 * inutile per lo stesso identico secondo che passa (v. discussione con
 * l'utente sul prototipo Claude Design). Il numero restituito non porta
 * alcuna informazione utile: serve solo a far ri-renderizzare chi lo usa
 * a ogni tick, che poi ricalcola il countdown vero leggendo l'orologio
 * reale (v. lib/capsule-countdown.ts).
 */
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function ensureInterval() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    listeners.forEach((notify) => notify());
  }, 1000);
}

function releaseIfIdle() {
  if (listeners.size > 0 || intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * `enabled: false` per una capsula già aperta --- niente più da far
 * scorrere, nessun bisogno di restare iscritti al tick condiviso.
 */
export function useCountdownTick(enabled: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const notify = () => setTick((t) => t + 1);
    listeners.add(notify);
    ensureInterval();
    return () => {
      listeners.delete(notify);
      releaseIfIdle();
    };
  }, [enabled]);
}
