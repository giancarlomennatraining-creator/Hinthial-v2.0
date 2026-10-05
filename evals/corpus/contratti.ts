import type { EvalDocument } from "../types";

/** Contratti (tipo "contratto"): locazione, lavoro, abbonamento, fornitura. Tutti i dati sono inventati. */
export const contratti: EvalDocument[] = [
  {
    id: "contratto-locazione",
    label: "Locazione abitativa 4+4",
    pages: [
      `CONTRATTO DI LOCAZIONE AD USO ABITATIVO
Contratto n. LOC/2025/118

Tra IMMOBILIARE AURORA S.r.l., con sede in Via Toledo 100, Napoli (locatore),
e la sig.ra Ferri Elena, nata a Roma il 12/03/1990 (conduttrice).

Art. 1 - Oggetto. Il locatore concede in locazione l'appartamento sito in Napoli, Via Chiaia 22, interno 5.
Art. 2 - Durata. La locazione ha durata di quattro anni dal 15/09/2025 al 14/09/2029, rinnovabile per ulteriori quattro anni.
Art. 3 - Canone. Il canone annuo e' di euro 10.200,00, pagabile in rate mensili di euro 850,00 entro il giorno 5 di ogni mese.
Art. 4 - Disdetta. Ciascuna parte puo' dare disdetta con preavviso di sei mesi, da comunicare entro il 14/03/2029 per la prima scadenza.

Stipulato a Napoli il 01/09/2025.`,
    ],
    gold: {
      type: "contratto",
      expiry: ["2029-09-14"],
      issuer: "Immobiliare Aurora",
      category: ["Casa", "Contratti"],
      fields: {
        numero_contratto: "LOC/2025/118",
        data_stipula: "2025-09-01",
        data_decorrenza: "2025-09-15",
        importo: "850,00",
        preavviso_disdetta: "sei mesi",
      },
      events: ["2029-03-14"],
      notEvents: ["2025-09-01", "2025-09-15"],
    },
    note: "Stipula, decorrenza, scadenza e termine di disdetta sono quattro date diverse.",
  },
  {
    id: "contratto-lavoro-td",
    label: "Lavoro a tempo determinato",
    pages: [
      `CONTRATTO INDIVIDUALE DI LAVORO A TEMPO DETERMINATO
N. TD-2026-044

TECNOSUD S.r.l., Via Nuova Poggioreale 45, 80143 Napoli (il Datore di lavoro)
Sig. Marino Davide, nato a Salerno il 03/06/1996 (il Lavoratore)

1. Il rapporto di lavoro decorre dal 01/09/2026 e termina il 31/08/2027, salvo proroga.
2. Il Lavoratore e' assunto come addetto amministrativo, V livello CCNL Commercio.
3. La retribuzione lorda e' di euro 1.850,00 mensili per quattordici mensilita'.
4. Periodo di prova: trenta giorni di effettivo lavoro, fino al 01/10/2026.
5. Preavviso in caso di dimissioni: quindici giorni.

Napoli, 28/08/2026`,
    ],
    gold: {
      type: "contratto",
      expiry: ["2027-08-31"],
      issuer: "TecnoSud",
      category: ["Contratti", "Personale"],
      fields: {
        numero_contratto: "TD-2026-044",
        data_decorrenza: "2026-09-01",
        importo: "1.850,00",
        preavviso_disdetta: "quindici giorni",
      },
      events: [],
      notEvents: ["2026-08-28", "2026-09-01", "2026-10-01"],
    },
    note: "La fine del periodo di prova è passata: non è un evento.",
  },
  {
    id: "contratto-palestra",
    label: "Abbonamento palestra con rinnovo tacito",
    pages: [
      `FITCENTER NAPOLI S.r.l.
ABBONAMENTO ANNUALE - MODULO DI ADESIONE
Socio: Romano Chiara
Tessera n. FC-208841
Durata: 12 mesi, dal 01/10/2026 al 30/09/2027.
Quota: euro 39,90 al mese, addebitata con SDD.

Rinnovo: alla scadenza l'abbonamento si rinnova automaticamente per altri 12 mesi, salvo disdetta da inviare via PEC entro il 30/08/2027.`,
    ],
    gold: {
      type: "contratto",
      expiry: ["2027-09-30"],
      issuer: "FitCenter Napoli",
      category: ["Contratti", "Personale", "Salute"],
      fields: { numero_contratto: "FC-208841", data_decorrenza: "2026-10-01", importo: "39,90" },
      events: ["2027-08-30"],
      notEvents: ["2026-10-01"],
    },
  },
  {
    id: "contratto-internet",
    label: "Fornitura internet con vincolo",
    pages: [
      `TELENOVA S.p.A.
PROPOSTA DI CONTRATTO FIBRA CASA
Contratto n. TN-9981234
Cliente: Bruno Salvatore, Via Posillipo 77, Napoli
Attivazione del servizio: 10/07/2026
Costo mensile: euro 29,90 (IVA inclusa).
Vincolo contrattuale: 24 mesi dall'attivazione, quindi fino al 10/07/2028. Dopo il vincolo e' possibile recedere senza penali con preavviso di 30 giorni.`,
    ],
    gold: {
      type: "contratto",
      expiry: ["2028-07-10"],
      issuer: "Telenova",
      category: ["Contratti", "Casa"],
      fields: { numero_contratto: "TN-9981234", data_decorrenza: "2026-07-10", importo: "29,90", preavviso_disdetta: "30 giorni" },
      events: [],
      notEvents: ["2026-07-10"],
    },
    note: "Il vincolo è una scadenza dichiarata; il recesso senza penali non ha una data.",
  },
];
