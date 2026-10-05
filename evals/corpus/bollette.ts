import type { EvalDocument } from "../types";

/** Bollette di luce, gas, acqua e internet (tipo "bolletta"). Fornitori, codici e importi sono inventati. */
export const bollette: EvalDocument[] = [
  {
    id: "bolletta-luce",
    label: "Luce, Enel Energia",
    pages: [
      `ENEL ENERGIA S.p.A.
BOLLETTA DELLA LUCE
Fattura n. 6200417738 del 05/10/2026
Intestatario: Rossi Marco - Via Roma 12, Napoli
Codice POD: IT001E12345678
Periodo di fatturazione: dal 01/07/2026 al 31/08/2026
Consumo fatturato: 412 kWh
Totale da pagare: euro 87,32
Scadenza: 20/10/2026
Modalita' di pagamento: bollettino postale, home banking o addebito diretto.`,
    ],
    gold: {
      type: "bolletta",
      expiry: [],
      issuer: "Enel Energia",
      category: ["Casa"],
      fields: {
        fornitore: "Enel Energia",
        numero_fattura: "6200417738",
        periodo_fatturazione: "01/07/2026 al 31/08/2026",
        importo_totale: "87,32",
        data_scadenza_pagamento: "2026-10-20",
        codice_fornitura: "IT001E12345678",
      },
      events: ["2026-10-20"],
      notEvents: ["2026-10-05", "2026-07-01", "2026-08-31"],
    },
    note: "Il periodo di fatturazione non è un evento; la scadenza di pagamento sì.",
  },
  {
    id: "bolletta-gas-con-contratto",
    label: "Gas, Edison, con scadenza dell'offerta",
    pages: [
      `EDISON ENERGIA S.p.A.
BOLLETTA GAS
Documento n. 8841-2026-00917 emesso il 10/10/2026
Cliente: Esposito Giulia - Via dei Mille 8, Torino
PDR: 14380000123456
Periodo: agosto - settembre 2026
Importo da pagare: euro 112,45
Data di scadenza: 28/10/2026

Comunicazioni: il contratto di fornitura a prezzo fisso scade il 31/12/2027. Prima della scadenza ti proporremo una nuova offerta.`,
    ],
    gold: {
      type: "bolletta",
      expiry: ["2027-12-31"],
      issuer: "Edison Energia",
      category: ["Casa"],
      fields: {
        fornitore: "Edison Energia",
        numero_fattura: "8841-2026-00917",
        importo_totale: "112,45",
        data_scadenza_pagamento: "2026-10-28",
        codice_fornitura: "14380000123456",
      },
      events: ["2026-10-28"],
      notEvents: ["2026-10-10"],
    },
    note: "Due date future diverse: pagamento (evento) e fine del contratto (scadenza).",
  },
  {
    id: "bolletta-acqua",
    label: "Acqua",
    pages: [
      `ACQUEDOTTO MERIDIONALE S.p.A.
Fattura servizio idrico integrato n. 2026/771245
Emessa il 02/10/2026
Utente: Verdi Anna - codice utenza U-5530921
Consumo del semestre aprile-settembre 2026: 74 metri cubi
Importo totale: euro 64,10
Da pagare entro il 05/11/2026 presso tabaccherie, uffici postali o con PagoPA.`,
    ],
    gold: {
      type: "bolletta",
      expiry: [],
      issuer: "Acquedotto Meridionale",
      category: ["Casa"],
      fields: { fornitore: "Acquedotto Meridionale", numero_fattura: "2026/771245", importo_totale: "64,10", data_scadenza_pagamento: "2026-11-05", codice_fornitura: "U-5530921" },
      events: ["2026-11-05"],
      notEvents: ["2026-10-02"],
    },
  },
  {
    id: "bolletta-internet",
    label: "Internet con addebito automatico",
    pages: [
      `TELENOVA S.p.A. - FATTURA N. TN-2026-5530177
Data di emissione: 01/10/2026
Contratto TN-9981234 - Cliente: Bruno Salvatore
Servizio: Fibra Casa, periodo ottobre - novembre 2026
Totale fattura: euro 29,90 (IVA inclusa)
L'importo sara' addebitato automaticamente sul conto corrente il 31/10/2026.`,
    ],
    gold: {
      type: "bolletta",
      expiry: [],
      issuer: "Telenova",
      category: ["Casa", "Contratti"],
      fields: { fornitore: "Telenova", numero_fattura: "TN-2026-5530177", importo_totale: "29,90", data_scadenza_pagamento: "2026-10-31" },
      events: ["2026-10-31"],
      notEvents: ["2026-10-01"],
    },
  },
];
