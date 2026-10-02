/**
 * Ciò che, se cambia, rende una lettura salvata non più equivalente a una nuova: entra nell'impronta di idempotenza
 * (v. persisted.ts). Si alza a mano quando cambia il prompt, lo schema dei campi o la validazione.
 */
export const ANALYSIS_SCHEMA_VERSION = 1;
/** 2: la lettura ricava anche gli eventi con data (verso Scadenze). Le letture salvate con la 1 risultano da rileggere. */
export const ANALYSIS_PIPELINE_VERSION = 2;

export const ANALYSIS_MODELS = {
  block: "claude-haiku-4-5-20251001",
  merge: "claude-haiku-4-5-20251001",
} as const;
