import type { EvalDocument } from "../types";

/** Certificati, estratti conto e verbali: i tipi aggiunti al registro dopo la prima misura (prima erano "generico"). */
export const generici: EvalDocument[] = [
  {
    id: "certificato-residenza",
    label: "Certificato di residenza",
    pages: [
      `COMUNE DI NAPOLI - SERVIZI DEMOGRAFICI
CERTIFICATO DI RESIDENZA
L'Ufficiale di Anagrafe certifica che il sig. Rossi Marco, nato a Napoli il 05/04/1985, risulta residente in Napoli, Via Roma 12.
Il presente certificato e' rilasciato per uso amministrativo.
Napoli, 14/09/2026
Protocollo n. 2026/0045512`,
    ],
    gold: {
      type: "certificato",
      expiry: [],
      issuer: "Comune di Napoli",
      category: ["Personale"],
      fields: { numero_certificato: "2026/0045512", data_rilascio: "2026-09-14" },
      events: [],
      notEvents: ["2026-09-14", "1985-04-05"],
    },
    note: "Il certificato non dichiara una scadenza: nessuna deve essere dedotta.",
  },
  {
    id: "estratto-conto-mutuo",
    label: "Estratto conto con rata del mutuo",
    pages: [
      `BANCA MERIDIONALE S.p.A.
ESTRATTO CONTO - TERZO TRIMESTRE 2026 (luglio - settembre)
Intestatario: Greco Luigi
IBAN: IT60 X054 2811 1010 0000 0123 456
Saldo iniziale al 01/07/2026: euro 4.215,30
Saldo finale al 30/09/2026: euro 3.870,12
Movimenti principali: stipendio euro 1.920,00 (ogni 27 del mese); rata mutuo euro 640,00 (ogni 5 del mese).

Avviso: la prossima rata del mutuo sara' addebitata il 05/11/2026.`,
    ],
    gold: {
      type: "estratto_conto",
      expiry: [],
      issuer: "Banca Meridionale",
      category: ["Finanze"],
      fields: { iban: "IT60 X054 2811 1010 0000 0123 456", saldo_iniziale: "4.215,30", saldo_finale: "3.870,12" },
      events: ["2026-11-05"],
      notEvents: ["2026-07-01", "2026-09-30"],
    },
    note: "I giorni del mese ('ogni 5') non sono date; solo l'avviso ha una data esplicita.",
  },
  {
    id: "verbale-contravvenzione",
    label: "Verbale con due termini",
    pages: [
      `COMUNE DI TORRE DEL GRECO - POLIZIA LOCALE
VERBALE DI ACCERTAMENTO DI VIOLAZIONE N. PL/2026/033120
Violazione commessa il 02/08/2026 alle ore 10:15 in Via Nazionale: sosta in divieto, art. 158 Codice della Strada.
Veicolo: targa GH482XP
Il presente verbale e' stato notificato il 10/09/2026.

Pagamento: la sanzione e' di euro 42,00; se pagata entro 5 giorni dalla notifica l'importo e' ridotto a euro 29,40.
Entro il 09/11/2026 e' possibile pagare euro 42,00 con bonifico o PagoPA.
Ricorso: entro 60 giorni dalla notifica al Prefetto o entro 30 giorni al Giudice di Pace, cioe' entro il 10/10/2026.`,
    ],
    gold: {
      type: "verbale",
      expiry: ["2026-11-09"],
      issuer: "Comune di Torre del Greco",
      category: ["Veicoli", "Fiscale", "Personale", "Altro"],
      fields: { numero_verbale: "PL/2026/033120", data_violazione: "2026-08-02", importo_sanzione: "42,00", targa: "GH482XP" },
      events: ["2026-11-09", "2026-10-10"],
      notEvents: ["2026-08-02", "2026-09-10"],
    },
    note: "Il termine di pagamento è scadenza e evento, il termine di ricorso solo evento; le date della violazione e della notifica sono passate.",
  },
  {
    id: "ape-attestato",
    label: "Attestato di prestazione energetica",
    pages: [
      `STUDIO TECNICO ING. GALLO - CERTIFICATORE ENERGETICO
ATTESTATO DI PRESTAZIONE ENERGETICA (APE)
Codice identificativo: APE-NA-2026-004412
Immobile: appartamento in Napoli, Via Chiaia 22, int. 5
Classe energetica: D - EPgl,nren 118,4 kWh/m2 anno
Data di emissione: 14/06/2026
Validita': 10 anni. Il certificato e' valido fino al 14/06/2036.`,
    ],
    gold: {
      type: "certificato",
      expiry: ["2036-06-14"],
      issuer: "Studio Tecnico Ing. Gallo",
      category: ["Casa"],
      fields: { numero_certificato: "APE-NA-2026-004412", data_rilascio: "2026-06-14" },
      events: [],
      notEvents: ["2026-06-14"],
    },
  },
];
