/**
 * Ciò che, se cambia, rende una lettura salvata non più equivalente a una nuova: entra nell'impronta di idempotenza
 * (v. persisted.ts). Si alza a mano quando cambia il prompt, lo schema dei campi o la validazione.
 */
export const ANALYSIS_SCHEMA_VERSION = 1;
/**
 * 4: tre tipi in più (verbale, certificato, estratto conto). Le letture salvate con la 3 risultano da rileggere.
 * 2: la lettura ricava anche gli eventi con data (verso Scadenze). Le letture salvate con la 1 risultano da rileggere.
 * 3: campi con le chiavi del registro già al primo blocco, scadenza di pagamento anche come evento, appuntamenti con
 * orario, importi in qualunque ordine, categoria più spesso. Le letture salvate con la 2 risultano da rileggere.
 */
export const ANALYSIS_PIPELINE_VERSION = 4;

export const ANALYSIS_MODELS = {
  block: "claude-haiku-4-5-20251001",
  merge: "claude-haiku-4-5-20251001",
} as const;
