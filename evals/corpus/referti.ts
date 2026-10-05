import type { EvalDocument } from "../types";

/** Referti e certificati medici (tipo "referto"). Pazienti, medici e strutture sono inventati. */
export const referti: EvalDocument[] = [
  {
    id: "referto-cardiologia",
    label: "Visita cardiologica con controllo fissato",
    pages: [
      `POLIAMBULATORIO SAN MARCO
Via Cilea 120, 80127 Napoli - Tel. 081 000 1234

REFERTO DI VISITA CARDIOLOGICA CON ECG
Paziente: Colombo Andrea, nato il 22/02/1971
Data della visita: 18/09/2026
Medico refertante: Dott.ssa Elena Ferri, cardiologa

Anamnesi: ipertensione lieve in terapia. ECG a riposo: ritmo sinusale, frequenza 68 bpm, nessuna alterazione del tratto ST.
Conclusioni: quadro cardiologico nella norma. Si prosegue la terapia in atto.
Prossimo controllo fissato per il 20/03/2027 alle ore 10:30.`,
    ],
    gold: {
      type: "referto",
      expiry: [],
      issuer: "Poliambulatorio San Marco",
      category: ["Salute"],
      fields: {
        data_referto: "2026-09-18",
        struttura: "Poliambulatorio San Marco",
        medico: "Elena Ferri",
        tipo_esame: "visita cardiologica",
      },
      events: ["2027-03-20"],
      notEvents: ["2026-09-18", "1971-02-22"],
    },
    note: "La data di nascita e la data della visita non sono eventi; il controllo fissato sì.",
  },
  {
    id: "referto-analisi-sangue",
    label: "Esami del sangue",
    pages: [
      `LABORATORIO ANALISI VESUVIO S.r.l.
Direttore sanitario: Dott. Pietro Longo

ESAME: EMOCROMO COMPLETO E PROFILO LIPIDICO
Paziente: De Luca Sofia
Data del prelievo: 30/08/2026
Data del referto: 02/09/2026

Emoglobina 13,2 g/dL (12,0 - 16,0)
Globuli bianchi 6.800 /mm3 (4.000 - 10.000)
Colesterolo totale 212 mg/dL (valori desiderabili < 200)
Colesterolo HDL 58 mg/dL
Trigliceridi 96 mg/dL

Il referto non costituisce diagnosi; va valutato dal medico curante.`,
    ],
    gold: {
      type: "referto",
      expiry: [],
      issuer: "Laboratorio Analisi Vesuvio",
      category: ["Salute"],
      fields: { data_referto: "2026-09-02", struttura: "Laboratorio Analisi Vesuvio", tipo_esame: "Emocromo completo e profilo lipidico" },
      events: [],
      notEvents: ["2026-08-30", "2026-09-02"],
    },
  },
  {
    id: "referto-radiologia",
    label: "RX ginocchio con visita ortopedica",
    pages: [
      `CENTRO DIAGNOSTICO MERIDIANA
Referto di radiografia del ginocchio destro in due proiezioni
Paziente: Pagano Luca
Data dell'esame: 11/07/2026
Radiologo: Dott. Paolo Greco

Non si evidenziano lesioni ossee in atto. Lieve riduzione dello spazio articolare mediale.
Si consiglia valutazione ortopedica. Visita ortopedica prenotata il 12/01/2027 alle ore 9:30 presso la stessa struttura.`,
    ],
    gold: {
      type: "referto",
      expiry: [],
      issuer: "Centro Diagnostico Meridiana",
      category: ["Salute"],
      fields: { data_referto: "2026-07-11", struttura: "Centro Diagnostico Meridiana", medico: "Paolo Greco", tipo_esame: "radiografia del ginocchio" },
      events: ["2027-01-12"],
      notEvents: ["2026-07-11"],
    },
  },
  {
    id: "certificato-sportivo",
    label: "Certificato di idoneità sportiva",
    pages: [
      `ASL NAPOLI 1 CENTRO - MEDICINA DELLO SPORT
CERTIFICATO DI IDONEITA' ALLA PRATICA SPORTIVA NON AGONISTICA
Si certifica che il sig. Fontana Matteo, nato il 15/08/2008, a seguito di visita medica e ECG, e' idoneo alla pratica sportiva non agonistica.
Il certificato e' valido fino al 06/05/2027.
Napoli, 07/05/2026
Il medico: Dott. Carlo Esposito`,
    ],
    gold: {
      type: "referto",
      expiry: ["2027-05-06"],
      issuer: "ASL Napoli 1",
      category: ["Salute"],
      fields: { data_referto: "2026-05-07", medico: "Carlo Esposito" },
      events: [],
      notEvents: ["2026-05-07", "2008-08-15"],
    },
    note: "Un certificato con scadenza dichiarata.",
  },
];
