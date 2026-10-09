/**
 * Le classi dei controlli che si ripetono in tutta l'app: pulsante principale, pulsante secondario e campo di testo.
 * Un posto solo dove cambiarne l'aspetto; chi ha bisogno di una variante le compone (`${BTN_PRIMARY} disabled:opacity-50`).
 */
export const BTN_PRIMARY = "rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover";

export const BTN_SECONDARY =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

export const INPUT_FIELD =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
