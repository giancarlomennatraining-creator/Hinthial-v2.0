import type { EvalDocument } from "../types";

/** Fatture e ricevute (tipo "fattura"). Fornitori, partite IVA e importi sono inventati. */
export const fatture: EvalDocument[] = [
  {
    id: "fattura-idraulico",
    label: "Fattura idraulico con scadenza di pagamento",
    pages: [
      `IDRAULICA FRATELLI CONTE S.n.c.
Via Libertà 5, 80136 Napoli - P.IVA 01234567891

FATTURA N. 42/2026
Data: 12/09/2026
Cliente: Moretti Franco, Via Foria 30, Napoli

Sostituzione sifone e riparazione perdita bagno   euro 300,00
IVA 22%                                            euro  66,00
TOTALE DA PAGARE                                   euro 366,00

Pagamento con bonifico entro il 12/10/2026.`,
    ],
    gold: {
      type: "fattura",
      expiry: ["2026-10-12"],
      issuer: "Idraulica Fratelli Conte",
      category: ["Casa", "Fiscale"],
      fields: {
        numero_fattura: "42/2026",
        data_fattura: "2026-09-12",
        partita_iva: "01234567891",
        importo_totale: "366,00",
      },
      events: ["2026-10-12"],
      notEvents: ["2026-09-12"],
    },
  },
  {
    id: "fattura-software-termini-relativi",
    label: "Fattura con pagamento a 30 giorni (nessuna data)",
    pages: [
      `NUVOLA SOFTWARE S.r.l.
Piazza Municipio 1, 80133 Napoli - P.IVA 09876543210
FATTURA ELETTRONICA FT-2026-1187 del 30/09/2026
Abbonamento annuale piattaforma gestionale (ottobre 2026 - settembre 2027)
Imponibile euro 1.000,00 - IVA 22% euro 220,00 - Totale documento euro 1.220,00
Termini di pagamento: 30 giorni data fattura. Modalita': bonifico bancario.`,
    ],
    gold: {
      type: "fattura",
      expiry: [],
      issuer: "Nuvola Software",
      category: ["Fiscale", "Contratti", "Finanze", "Altro"],
      fields: { numero_fattura: "FT-2026-1187", data_fattura: "2026-09-30", partita_iva: "09876543210", importo_totale: "1.220,00" },
      events: [],
      notEvents: ["2026-09-30"],
    },
    note: "\"30 giorni data fattura\" richiederebbe un calcolo: nessun evento deve essere inventato.",
  },
  {
    id: "ricevuta-farmacia",
    label: "Scontrino di farmacia",
    pages: [
      `FARMACIA DOTT. RINALDI
Corso Garibaldi 210 - Napoli
Partita IVA 05566778899
DOCUMENTO COMMERCIALE DI VENDITA
22/09/2026 ore 17:42
Antinfiammatorio 12 cpr            euro 9,80
Integratore vitamina D             euro 14,90
Termometro digitale                euro 22,90
TOTALE COMPLESSIVO                 euro 47,60
Pagamento elettronico`,
    ],
    gold: {
      type: "fattura",
      expiry: [],
      issuer: "Farmacia Dott. Rinaldi",
      category: ["Salute", "Fiscale", "Altro"],
      fields: { data_fattura: "2026-09-22", importo_totale: "47,60" },
      events: [],
      notEvents: ["2026-09-22"],
    },
    note: "Uno scontrino detraibile: nessuna scadenza né evento.",
  },
  {
    id: "fattura-garanzia",
    label: "Fattura elettrodomestico con garanzia",
    pages: [
      `ELETTROMAX S.r.l.
Via dell'Industria 14, 80100 Napoli - P.IVA 03344556677
FATTURA N. A/2026/5521 - Data 20/08/2026
Cliente: Santoro Maria
Lavatrice WashPro 9 kg, matricola 8841230     euro 531,97
IVA 22%                                       euro 117,03
TOTALE                                        euro 649,00
Pagato in contanti alla consegna.

Garanzia legale di conformita' di 24 mesi: scade il 20/08/2028.`,
    ],
    gold: {
      type: "fattura",
      expiry: ["2028-08-20"],
      issuer: "ElettroMax",
      category: ["Casa", "Fiscale"],
      fields: {
        numero_fattura: "A/2026/5521",
        data_fattura: "2026-08-20",
        partita_iva: "03344556677",
        importo_totale: "649,00",
      },
      events: [],
      notEvents: ["2026-08-20"],
    },
    note: "La garanzia è la scadenza dichiarata del documento.",
  },
];
