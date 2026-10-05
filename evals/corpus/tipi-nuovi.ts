import type { EvalDocument } from "../types";

/** Altri documenti dei tipi aggiunti dopo la prima misura (verbale, certificato, estratto conto). Tutti i dati sono inventati. */
export const tipiNuovi: EvalDocument[] = [
  {
    id: "verbale-ztl",
    label: "Verbale ZTL con pagamento ridotto",
    pages: [
      `COMUNE DI NAPOLI - POLIZIA MUNICIPALE
VERBALE DI CONTESTAZIONE N. ZTL/2026/118402
Transito in zona a traffico limitato senza autorizzazione, accertato il 21/08/2026 alle ore 08:52 in Via dei Mille.
Veicolo targa DM731KZ intestato a Bianchi Carla.
Notificato il 29/09/2026.
Sanzione: euro 85,00. Pagamento in misura ridotta di euro 59,50 entro il 03/11/2026.
Ricorso al Prefetto entro 60 giorni dalla notifica, quindi entro il 28/11/2026.`,
    ],
    gold: {
      type: "verbale",
      expiry: ["2026-11-03"],
      issuer: "Comune di Napoli",
      category: ["Veicoli", "Fiscale", "Personale", "Altro"],
      fields: { numero_verbale: "ZTL/2026/118402", data_violazione: "2026-08-21", importo_sanzione: "85,00", targa: "DM731KZ" },
      events: ["2026-11-03", "2026-11-28"],
      notEvents: ["2026-08-21", "2026-09-29"],
    },
    note: "Pagamento ridotto (scadenza e evento) e ricorso (solo evento).",
  },
  {
    id: "certificato-stato-famiglia",
    label: "Certificato di stato di famiglia",
    pages: [
      `COMUNE DI SALERNO - UFFICIO ANAGRAFE
CERTIFICATO DI STATO DI FAMIGLIA
Si certifica che la famiglia anagrafica del sig. Marino Davide, residente in Salerno, Via Roma 40, e' composta da tre persone.
Rilasciato il 02/09/2026 per uso amministrativo.
Protocollo n. 2026/0031877 - Il certificato ha validita' di sei mesi dalla data del rilascio.`,
    ],
    gold: {
      type: "certificato",
      expiry: [],
      issuer: "Comune di Salerno",
      category: ["Personale"],
      fields: { numero_certificato: "2026/0031877", data_rilascio: "2026-09-02", intestatario: "Marino Davide" },
      events: [],
      notEvents: ["2026-09-02"],
    },
    note: "Validità 'di sei mesi': richiederebbe un calcolo, nessuna scadenza deve essere inventata.",
  },
  {
    id: "estratto-conto-carta",
    label: "Estratto conto carta di credito",
    pages: [
      `BANCA DEL MEDITERRANEO S.p.A.
ESTRATTO CONTO CARTA DI CREDITO - SETTEMBRE 2026
Titolare: Santoro Maria - Carta n. 5412 **** **** 0098
Periodo di riferimento: dal 01/09/2026 al 30/09/2026
Saldo precedente: euro 120,00
Totale spese del mese: euro 486,35
Saldo da addebitare: euro 606,35
L'importo verra' addebitato sul conto corrente il 15/10/2026.`,
    ],
    gold: {
      type: "estratto_conto",
      expiry: ["2026-10-15"],
      issuer: "Banca del Mediterraneo",
      category: ["Finanze"],
      fields: { saldo_iniziale: "120,00", saldo_finale: "606,35" },
      events: ["2026-10-15"],
      notEvents: ["2026-09-01", "2026-09-30"],
    },
    note: "La data di addebito è la scadenza di pagamento di questo documento: scadenza e evento.",
  },
];
