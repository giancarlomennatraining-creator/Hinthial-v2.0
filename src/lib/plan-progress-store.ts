import { useSyncExternalStore } from "react";

/**
 * L'ultimo avanzamento del piano ("4 passi su 9"), per l'indicatore nel menu. Il piano si calcola con i dati di "Oggi", che
 * sono i più freschi: quando "Oggi" li ha, li passa qui, e l'indicatore si aggiorna senza rileggere tutto a ogni cambio
 * di pagina. Sono due numeri, non dati della cassaforte.
 */
export interface PlanProgressSnapshot {
  done: number;
  total: number;
}

let current: PlanProgressSnapshot | null = null;
const listeners = new Set<() => void>();

export function publishPlanProgress(next: PlanProgressSnapshot | null): void {
  if (current?.done === next?.done && current?.total === next?.total) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlanProgress(): PlanProgressSnapshot | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
