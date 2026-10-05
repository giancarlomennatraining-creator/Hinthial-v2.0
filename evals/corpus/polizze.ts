import type { EvalDocument } from "../types";

/** Polizze assicurative (tipo "polizza"). Tutti i dati sono inventati. */
export const polizze: EvalDocument[] = [
  {
    id: "polizza-rca-generali",
    label: "RC auto, Generali",
    pages: [
      `GENERALI ITALIA S.p.A.
Sede legale: Via Marocchesa 14, 31021 Mogliano Veneto (TV)

CERTIFICATO DI ASSICURAZIONE - RESPONSABILITA' CIVILE AUTOVEICOLI
Polizza n. 400/88231907
Contraente: Rossi Marco, Via Roma 12, 80100 Napoli
Veicolo: FIAT Panda, targa GH482XP
Decorrenza della copertura: 14/03/2026 ore 24:00
Scadenza della copertura: 14/03/2027 ore 24:00
Premio annuo lordo: euro 612,40
Massimale RCA: euro 6.070.000,00
Emessa a Napoli il 10/03/2026`,
    ],
    gold: {
      type: "polizza",
      expiry: ["2027-03-14"],
      issuer: "Generali Italia",
      category: ["Assicurazioni", "Veicoli"],
      fields: {
        numero_polizza: "400/88231907",
        data_decorrenza: "2026-03-14",
        premio: "612,40",
        massimale: "6.070.000,00",
        oggetto_assicurato: "FIAT Panda",
      },
      events: [],
      notEvents: ["2026-03-10", "2026-03-14"],
    },
    note: "Caso base: una scadenza, date di emissione e decorrenza da non confondere.",
  },
  {
    id: "polizza-casa-allianz",
    label: "Casa, Allianz, con disdetta",
    pages: [
      `ALLIANZ S.p.A.
POLIZZA MULTIRISCHIO ABITAZIONE "CASA SERENA"
Numero polizza: ALL-HM-77412035
Assicurato: Esposito Giulia
Ubicazione del rischio: Via dei Mille 8, 10123 Torino
Effetto: 01/06/2026
Scadenza: 31/05/2027
Premio annuo: euro 248,00
Somma assicurata contenuto: euro 150.000,00
Contratto emesso il 20/05/2026.

La polizza si rinnova tacitamente di anno in anno. Per evitare il rinnovo la disdetta va inviata con raccomandata A/R entro il 01/04/2027.`,
    ],
    gold: {
      type: "polizza",
      expiry: ["2027-05-31"],
      issuer: "Allianz",
      category: ["Assicurazioni", "Casa"],
      fields: {
        numero_polizza: "ALL-HM-77412035",
        data_decorrenza: "2026-06-01",
        premio: "248,00",
        massimale: "150.000,00",
        oggetto_assicurato: "Via dei Mille 8",
      },
      events: ["2027-04-01"],
      notEvents: ["2026-05-20", "2026-06-01"],
    },
    note: "Disdetta con data esplicita: va riportata come evento, la scadenza come scadenza.",
  },
  {
    id: "polizza-salute-unipol",
    label: "Salute, UnipolSai, due pagine",
    pages: [
      `UNIPOLSAI ASSICURAZIONI S.p.A.
POLIZZA SANITARIA INDIVIDUALE
Polizza n. SAL/2026/0098765
Contraente e assicurato: Verdi Anna
Decorrenza: 01/01/2026
Scadenza: 31/12/2026
Premio annuo: euro 1.340,00, pagabile in due rate semestrali.
Massimale annuo per assicurato: euro 500.000,00`,
      `CONDIZIONI DI PAGAMENTO
Prima rata: euro 670,00, pagata il 02/01/2026.
Seconda rata: euro 670,00 con scadenza il 01/12/2026.
Il mancato pagamento della seconda rata entro quindici giorni sospende le garanzie.

Assistenza clienti: numero verde 800 000 111, dal lunedi al venerdi.`,
    ],
    gold: {
      type: "polizza",
      expiry: ["2026-12-31"],
      issuer: "UnipolSai",
      category: ["Assicurazioni", "Salute"],
      fields: { numero_polizza: "SAL/2026/0098765", data_decorrenza: "2026-01-01", premio: "1.340,00", massimale: "500.000,00" },
      events: ["2026-12-01"],
      notEvents: ["2026-01-02", "2026-01-01"],
    },
    note: "Due pagine: scadenza a pagina 1, rata a pagina 2.",
  },
  {
    id: "polizza-vita-lunga",
    label: "Vita, scadenza lontana",
    pages: [
      `POSTEVITA S.p.A. - POLIZZA VITA "FUTURO SICURO"
Numero polizza: PV-3300-91827
Contraente: Greco Luigi
Data di decorrenza: 01/10/2021
Data di scadenza del contratto: 30/09/2041
Capitale assicurato in caso di decesso: euro 100.000,00
Premio mensile: euro 90,00 con addebito sul conto corrente il giorno 5 di ogni mese.`,
    ],
    gold: {
      type: "polizza",
      expiry: ["2041-09-30"],
      issuer: "PosteVita",
      category: ["Assicurazioni", "Finanze", "Personale"],
      fields: { numero_polizza: "PV-3300-91827", data_decorrenza: "2021-10-01", premio: "90,00", massimale: "100.000,00" },
      events: [],
      notEvents: ["2021-10-01"],
    },
    note: "Il giorno 5 di ogni mese non è una data: non deve diventare un evento.",
  },
];
