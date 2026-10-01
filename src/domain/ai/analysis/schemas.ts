/**
 * Registro statico degli schemi per tipo di documento: dice al modello quali campi cercare e di che natura sono, e dice
 * alla validazione come controllarli. Statico di proposito (nessun tipo inventato dal modello, nessuno schema da
 * database): un tipo sconosciuto ricade su "generico".
 */

export type AnalysisValueType = "date" | "text" | "amount" | "identifier";

export interface SchemaField {
  /** snake_case, stessa convenzione del vocabolario dei campi (domain/structured-fields). */
  key: string;
  label: string;
  valueType: AnalysisValueType;
}

export interface AnalysisSchema {
  id: AnalysisDocumentType;
  label: string;
  /** Una riga che aiuta il modello a riconoscere il tipo. */
  description: string;
  /** Campi attesi oltre a scadenza ed emittente, che hanno un posto loro. */
  fields: SchemaField[];
}

export const ANALYSIS_DOCUMENT_TYPES = ["contratto", "referto", "fattura", "bolletta", "polizza", "generico"] as const;

export type AnalysisDocumentType = (typeof ANALYSIS_DOCUMENT_TYPES)[number];

export const ANALYSIS_SCHEMAS: Record<AnalysisDocumentType, AnalysisSchema> = {
  contratto: {
    id: "contratto",
    label: "Contratto",
    description: "accordo tra parti con obblighi, durata e condizioni (locazione, fornitura, lavoro, abbonamento)",
    fields: [
      { key: "numero_contratto", label: "Numero contratto", valueType: "identifier" },
      { key: "controparte", label: "Controparte", valueType: "text" },
      { key: "data_stipula", label: "Data di stipula", valueType: "date" },
      { key: "data_decorrenza", label: "Data di decorrenza", valueType: "date" },
      { key: "durata", label: "Durata", valueType: "text" },
      { key: "importo", label: "Importo", valueType: "amount" },
      { key: "preavviso_disdetta", label: "Preavviso di disdetta", valueType: "text" },
    ],
  },
  referto: {
    id: "referto",
    label: "Referto",
    description: "esito di visita, esame o analisi cliniche",
    fields: [
      { key: "data_referto", label: "Data del referto", valueType: "date" },
      { key: "struttura", label: "Struttura", valueType: "text" },
      { key: "medico", label: "Medico", valueType: "text" },
      { key: "tipo_esame", label: "Tipo di esame", valueType: "text" },
    ],
  },
  fattura: {
    id: "fattura",
    label: "Fattura",
    description: "fattura o ricevuta di un acquisto o di una prestazione",
    fields: [
      { key: "numero_fattura", label: "Numero fattura", valueType: "identifier" },
      { key: "data_fattura", label: "Data fattura", valueType: "date" },
      { key: "fornitore", label: "Fornitore", valueType: "text" },
      { key: "partita_iva", label: "Partita IVA", valueType: "identifier" },
      { key: "importo_totale", label: "Importo totale", valueType: "amount" },
      { key: "data_scadenza_pagamento", label: "Scadenza del pagamento", valueType: "date" },
    ],
  },
  bolletta: {
    id: "bolletta",
    label: "Bolletta",
    description: "bolletta di luce, gas, acqua, telefono o internet",
    fields: [
      { key: "fornitore", label: "Fornitore", valueType: "text" },
      { key: "numero_fattura", label: "Numero fattura", valueType: "identifier" },
      { key: "periodo_fatturazione", label: "Periodo di fatturazione", valueType: "text" },
      { key: "importo_totale", label: "Importo totale", valueType: "amount" },
      { key: "data_scadenza_pagamento", label: "Scadenza del pagamento", valueType: "date" },
      { key: "codice_fornitura", label: "Codice fornitura (POD/PDR/utenza)", valueType: "identifier" },
    ],
  },
  polizza: {
    id: "polizza",
    label: "Polizza assicurativa",
    description: "polizza o appendice assicurativa (auto, casa, salute, vita)",
    fields: [
      { key: "numero_polizza", label: "Numero polizza", valueType: "identifier" },
      { key: "compagnia", label: "Compagnia", valueType: "text" },
      { key: "data_decorrenza", label: "Data di decorrenza", valueType: "date" },
      { key: "premio", label: "Premio", valueType: "amount" },
      { key: "massimale", label: "Massimale", valueType: "amount" },
      { key: "oggetto_assicurato", label: "Oggetto assicurato", valueType: "text" },
    ],
  },
  generico: {
    id: "generico",
    label: "Documento generico",
    description: "qualsiasi documento che non rientra negli altri tipi",
    fields: [],
  },
};

export function isAnalysisDocumentType(value: unknown): value is AnalysisDocumentType {
  return typeof value === "string" && (ANALYSIS_DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Lo schema del tipo dato, o quello generico per qualsiasi cosa non sia nel registro. */
export function resolveAnalysisSchema(id: unknown): AnalysisSchema {
  return isAnalysisDocumentType(id) ? ANALYSIS_SCHEMAS[id] : ANALYSIS_SCHEMAS.generico;
}
