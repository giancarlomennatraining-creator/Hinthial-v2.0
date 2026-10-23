/**
 * Le classi che si ripetono in tutta l'app: pulsante principale, pulsante secondario, campo di testo e riquadro.
 * Un posto solo dove cambiarne l'aspetto; chi ha bisogno di una variante le compone (`${BTN_PRIMARY} disabled:opacity-50`).
 */
export const BTN_PRIMARY = "rounded-btn bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover";

export const BTN_SECONDARY =
  "rounded-btn border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

/**
 * Il riquadro: sfondo, bordo e raggio che cambiano con lo stile (v. `surface-card` in globals.css). `PANEL` ha l'ombra leggera,
 * `PANEL_FLAT` no. Si compongono con spaziature e disposizione (`${PANEL} flex flex-col gap-3 p-4`).
 */
export const PANEL =
  "surface-card rounded-card border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950";

export const PANEL_FLAT = "surface-card rounded-card border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

export const INPUT_FIELD =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
