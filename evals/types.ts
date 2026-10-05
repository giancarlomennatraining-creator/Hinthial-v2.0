import type { AnalysisDocumentType } from "@/domain/ai/analysis/schemas";

/**
 * Un documento inventato per misurare la qualità della lettura, con le risposte giuste. Nessun dato è reale: nomi,
 * numeri, indirizzi e codici sono finti.
 */
export interface EvalDocument {
  id: string;
  /** Come lo si riconosce in un rapporto. */
  label: string;
  /** Il testo, una voce per pagina: è ciò che l'estrazione sul dispositivo consegnerebbe. */
  pages: string[];
  gold: EvalGold;
  /** Cosa mette alla prova questo documento. */
  note?: string;
  /** Testo sporco di proposito (OCR): i dati annotati possono non comparire alla lettera, e il controllo del corpus li salta. */
  dirty?: boolean;
}

export interface EvalGold {
  /** Il tipo del registro degli schemi (v. domain/ai/analysis/schemas). */
  type: AnalysisDocumentType;
  /** Scadenze dichiarate del documento (ISO), per esempio "valida fino al". */
  expiry: string[];
  /** Chi ha emesso il documento, scritto come compare; null se non c'è. */
  issuer: string | null;
  /** Nomi di categoria accettabili (basta uno); null = non si deve proporre nessuna categoria. */
  category: string[] | null;
  /** Campi attesi, per chiave del registro: valore come compare nel documento. Non esaustivo: i campi in più non penalizzano. */
  fields: Record<string, string>;
  /** Date future da ricordare (ISO), esclusa la scadenza del documento: elenco esaustivo. */
  events: string[];
  /** Date che sono nel testo ma NON devono diventare eventi (emissione, stipula, decorrenza, date passate). */
  notEvents: string[];
  /** Valori che non devono comparire in nessun punto del risultato (per esempio quelli di un'istruzione ostile). */
  forbidden?: string[];
}
