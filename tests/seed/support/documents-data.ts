/**
 * I documenti del profilo demo di Marta Conti: un archivio "vissuto", con ogni casistica che l'Archivio sa mostrare.
 * Solo dati: come si caricano è in demo.seed.ts. Le scadenze sono giorni da oggi (negativo = già passata), così il
 * profilo resta "vivo" a ogni nuova semina; `{scad}` nel testo di un PDF diventa la data di scadenza del documento.
 */

export type Kind = "pdf" | "image" | "note" | "audio";

/** "unread": il file non è mai stato letto (da "Leggili ora"); "none": letto ma senza testo (una foto). */
export type Reading = "text" | "unread" | "none";

export interface DocSpec {
  key: string;
  kind: Kind;
  /** Il nome con cui si vede in Archivio. */
  title: string;
  category: string | null;
  issuer?: string;
  /** Giorni da oggi alla scadenza (negativo = scaduto). */
  expires?: number;
  notes?: string;
  asset?: string;
  dossiers?: string[];
  /** Voci della Scheda (importo_totale, targa, numero_polizza…). */
  fields?: Record<string, string>;
  /** Da quanti giorni è in Archivio (la data di aggiunta). */
  addedAgo: number;
  /** Righe del PDF (la prima è il titolo) o corpo della nota. */
  lines?: string[];
  body?: string;
  /** Per le immagini: didascalia e colori. */
  picture?: { caption: string; hue: [string, string] };
  accent?: string;
  reading?: Reading;
  /** Una sintesi di Hinthia già salvata. */
  synthesis?: string;
  trashed?: boolean;
  excludeFromAI?: boolean;
}

const pdf = (
  key: string,
  title: string,
  category: string | null,
  issuer: string,
  rows: string[],
  extra: Partial<DocSpec> & { addedAgo: number },
): DocSpec => ({
  key,
  kind: "pdf",
  title,
  category,
  issuer,
  lines: [title, issuer, "", ...rows],
  accent: ACCENTS[issuer.length % ACCENTS.length],
  reading: "text",
  ...extra,
});

const ACCENTS = ["#1d7a4a", "#1b4fd0", "#7a3fb0", "#b5532a", "#0f6f8a", "#9a6b00"];

export const DOCUMENTS: DocSpec[] = [
  // ---------- Assicurazioni ----------
  pdf("pol-auto", "Polizza auto Fiat Panda", "Assicurazioni", "Generali Italia S.p.A.", [
    "Contraente: Marta Conti - Codice fiscale CNTMRT68C45H501X",
    "Veicolo assicurato: Fiat Panda 1.2 - Targa FG 482 KT",
    "Numero polizza 1/84250/1263",
    "Garanzie: RC auto, furto e incendio, cristalli, assistenza stradale",
    "Massimale RC: 10.000.000 EUR",
    "Premio annuo: 412,00 EUR (rata unica)",
    "Scadenza: {scad}",
    "Franchigia furto e incendio: 250 EUR",
    "In caso di sinistro chiamare il numero verde 800 880 880",
  ], {
    expires: 34, asset: "panda", addedAgo: 330,
    fields: { targa: "FG 482 KT", numero_polizza: "1/84250/1263", importo: "412,00" },
    notes: "Il rinnovo arriva per email a settembre: controllare che la targa sia giusta.",
    synthesis: "Polizza RC auto con garanzie furto, incendio e cristalli per la Fiat Panda targata FG 482 KT. Premio annuo 412 euro, scade il 12 settembre.",
  }),
  pdf("pol-casa", "Polizza casa Via Roma", "Assicurazioni", "Allianz", [
    "Contraenti: Marta Conti e Paolo Conti",
    "Fabbricato: Via Roma 12, Bologna - 96 mq, quinto piano",
    "Numero polizza ALZ-77120-C",
    "Garanzie: incendio, danni da acqua, furto, responsabilita civile famiglia",
    "Somma assicurata fabbricato: 240.000 EUR",
    "Premio annuo: 318,50 EUR",
    "Scadenza: {scad}",
  ], { expires: 212, asset: "casa-roma", addedAgo: 190, fields: { numero_polizza: "ALZ-77120-C", importo: "318,50" } }),
  pdf("pol-vita", "Polizza vita Marta", "Assicurazioni", "Reale Mutua", [
    "Assicurata: Marta Conti",
    "Beneficiari: Paolo Conti (50%), Luca Conti (25%), Giulia Conti (25%)",
    "Capitale assicurato: 150.000 EUR",
    "Premio annuo: 960,00 EUR",
    "Scadenza contrattuale: {scad}",
  ], { expires: 1700, addedAgo: 600, notes: "Originale nel cassetto della scrivania, secondo a sinistra." }),
  pdf("pol-sanitaria", "Polizza sanitaria famiglia", "Assicurazioni", "UnipolSai", [
    "Nucleo assicurato: Marta, Paolo, Luca, Giulia Conti",
    "Rimborso visite specialistiche: 80%, massimale 2.500 EUR",
    "Rimborso ricoveri: 100%",
    "Numero polizza UNI-5521990",
    "Scadenza: {scad}",
  ], { expires: 18, addedAgo: 340, fields: { numero_polizza: "UNI-5521990" } }),

  // ---------- Veicoli ----------
  pdf("bollo-panda", "Bollo auto 2026", "Veicoli", "ACI", [
    "Tassa automobilistica 2026 - Regione Emilia-Romagna",
    "Veicolo: Fiat Panda - Targa FG 482 KT",
    "Importo dovuto: 187,45 EUR",
    "Periodo di validita: 12 mesi",
    "Scadenza pagamento: ultimo giorno del mese di immatricolazione",
  ], { expires: -9, asset: "panda", addedAgo: 45, fields: { targa: "FG 482 KT", importo: "187,45" }, notes: "Da pagare: rimane da fare." }),
  pdf("revisione-panda", "Revisione Panda", "Veicoli", "Motorizzazione Civile", [
    "Esito: REGOLARE",
    "Veicolo: Fiat Panda - Targa FG 482 KT",
    "Data revisione: 14/10/2024",
    "Revisione da rinnovare entro: {scad}",
  ], { expires: 11, asset: "panda", addedAgo: 700, fields: { targa: "FG 482 KT" } }),
  pdf("libretto-vespa", "Libretto Vespa", "Veicoli", "Motorizzazione Civile", [
    "Ciclomotore: Piaggio Vespa Primavera 125",
    "Targa AB12345 - Anno 2019",
    "Intestatario: Marta Conti",
    "Cilindrata 125 cc",
  ], { asset: "vespa", addedAgo: 820, fields: { targa: "AB12345" } }),
  pdf("assic-vespa", "Assicurazione Vespa", "Assicurazioni", "Sara Assicurazioni", [
    "RC ciclomotori - Targa AB12345",
    "Premio annuo: 148,00 EUR",
    "Numero polizza SA-30881",
  ], { expires: 95, asset: "vespa", addedAgo: 260, fields: { targa: "AB12345", numero_polizza: "SA-30881", importo: "148,00" } }),

  // ---------- Casa ----------
  pdf("atto-viareggio", "Atto di acquisto casa Viareggio", "Casa", "Studio Notarile Neri", [
    "Repertorio n. 18.442 - Raccolta n. 9.201",
    "Compravendita di immobile: appartamento in Viareggio (LU), Via Fratti 40",
    "Parti: Bianchi Giorgio (venditore) - Conti Marta e Conti Paolo (acquirenti)",
    "Prezzo: 215.000 EUR",
    "Data dell'atto: 22/05/2025",
    "Notaio: Silvia Neri",
  ], { asset: "casa-viareggio", dossiers: ["viareggio"], addedAgo: 140, notes: "Copia conforme in archivio dal notaio." }),
  pdf("mutuo-viareggio", "Contratto di mutuo Viareggio", "Finanze", "Intesa Sanpaolo", [
    "Mutuo ipotecario prima casa - N. 1204/77",
    "Mutuatari: Marta Conti, Paolo Conti",
    "Importo erogato: 150.000 EUR - Durata 25 anni",
    "Tasso fisso 3,15%",
    "Rata mensile: 724,20 EUR, addebito il 5 di ogni mese",
  ], { asset: "casa-viareggio", dossiers: ["viareggio"], addedAgo: 138, fields: { importo: "724,20" } }),
  pdf("visura-viareggio", "Visura catastale Viareggio", "Casa", "Agenzia delle Entrate", [
    "Comune di Viareggio - Foglio 22 Particella 1904 Sub 11",
    "Categoria A/2 - Classe 4 - Vani 4,5",
    "Rendita catastale: 487,60 EUR",
  ], { asset: "casa-viareggio", dossiers: ["viareggio"], addedAgo: 160 }),
  pdf("preventivo-bagno", "Preventivo ristrutturazione bagno", "Casa", "Edilizia Verdi S.r.l.", [
    "Offerta n. 214/2026 - Bagno principale Via Roma 12",
    "Demolizioni e smaltimento: 1.350,00 EUR",
    "Impianto idraulico e scarichi: 1.900,00 EUR",
    "Pavimenti e rivestimenti (posa): 2.600,00 EUR",
    "Sanitari e rubinetteria (fornitura): 1.700,00 EUR",
    "Tinteggiatura e finiture: 850,00 EUR",
    "Totale IVA inclusa: 8.400,00 EUR",
    "Validita offerta: 60 giorni",
  ], { asset: "casa-roma", dossiers: ["bagno"], addedAgo: 52, fields: { importo_totale: "8.400,00" } }),
  pdf("fattura-idraulico", "Fattura idraulico (acconto)", "Casa", "Idraulica Moretti", [
    "Fattura n. 88 del 03/09/2026",
    "Acconto sui lavori di rifacimento impianto idraulico",
    "Imponibile 983,61 EUR - IVA 22% 216,39 EUR",
    "Totale: 1.200,00 EUR",
  ], { asset: "casa-roma", dossiers: ["bagno"], addedAgo: 38, fields: { importo_totale: "1.200,00" } }),
  pdf("fattura-piastrelle", "Fattura piastrelle", "Casa", "Ceramiche del Tirreno", [
    "Fattura n. 3102 del 21/08/2026",
    "Gres porcellanato 60x60 - 14 mq",
    "Totale: 2.150,00 EUR - consegna inclusa",
  ], { asset: "casa-roma", dossiers: ["bagno"], addedAgo: 55, fields: { importo_totale: "2.150,00" } }),
  pdf("visura-roma", "Visura catastale Via Roma", "Casa", "Agenzia delle Entrate", [
    "Comune di Bologna - Foglio 118 Particella 540 Sub 22",
    "Categoria A/3 - Vani 5",
    "Rendita catastale: 724,05 EUR",
  ], { asset: "casa-roma", addedAgo: 900 }),

  // ---------- Contratti ----------
  pdf("luce", "Contratto luce Via Roma", "Contratti", "Enel Energia", [
    "Fornitura energia elettrica - POD IT001E12345678",
    "Offerta: Prezzo Fisso 12 mesi",
    "Potenza impegnata 3 kW",
    "Scadenza offerta: {scad}",
    "Per recedere: raccomandata o PEC con 30 giorni di preavviso",
  ], { expires: 58, asset: "casa-roma", addedAgo: 300 }),
  pdf("fibra", "Contratto fibra casa", "Contratti", "TIM", [
    "Offerta TIM Fibra 1 Gbps",
    "Costo mensile: 29,90 EUR",
    "Vincolo contrattuale fino alla scadenza indicata",
    "Linea 051 5551234",
  ], { expires: 21, asset: "casa-roma", addedAgo: 520, notes: "Valutare un cambio operatore alla scadenza." }),
  pdf("box", "Contratto di locazione box", "Contratti", "Condominio Via Roma 12", [
    "Locazione box auto n. 14",
    "Canone mensile: 95,00 EUR",
    "Durata: 4 anni rinnovabili",
    "Locatore: Rossi Bruno",
  ], { expires: 380, addedAgo: 410 }),

  // ---------- Fiscale ----------
  pdf("cu", "Certificazione Unica 2026", "Fiscale", "Agenzia delle Entrate", [
    "Anno di imposta 2025",
    "Percipiente: Marta Conti",
    "Reddito di lavoro dipendente: 38.420,00 EUR",
    "Ritenute IRPEF operate: 8.150,00 EUR",
  ], { addedAgo: 215, fields: { importo_totale: "38.420,00" } }),
  pdf("730", "Dichiarazione 730/2026", "Fiscale", "CAF CISL", [
    "Dichiarazione dei redditi 730/2026 - Marta Conti",
    "Rimborso IRPEF a credito: 612,40 EUR",
    "Detrazioni: spese sanitarie, interessi sul mutuo, ristrutturazioni",
    "Presentata il 21/06/2026",
  ], { addedAgo: 120, fields: { importo_totale: "612,40" } }),
  pdf("imu", "IMU 2026 - saldo", "Fiscale", "Comune di Viareggio", [
    "Imposta municipale propria - seconda casa",
    "Rendita rivalutata e aliquota 1,06%",
    "Importo saldo: 412,00 EUR",
    "Scadenza versamento: {scad}",
  ], { expires: 46, asset: "casa-viareggio", addedAgo: 22, fields: { importo_totale: "412,00" } }),
  pdf("tari", "TARI 2026 - seconda rata", "Fiscale", "Comune di Bologna", [
    "Tassa sui rifiuti - utenza domestica Via Roma 12",
    "Seconda rata: 96,00 EUR",
    "Scadenza: tra pochi giorni",
  ], { expires: 3, asset: "casa-roma", addedAgo: 14, fields: { importo: "96,00" } }),

  // ---------- Salute ----------
  pdf("referto-ortopedico", "Referto visita ortopedica", "Salute", "Ospedale San Raffaele", [
    "Visita ortopedica del 12 marzo 2026",
    "Paziente: Marta Conti",
    "Motivo: dolore al ginocchio destro dopo caduta",
    "Esame obiettivo: lieve versamento, instabilita legamentosa",
    "Conclusioni: si consiglia risonanza magnetica e ciclo di fisioterapia",
    "Controllo fra 8 settimane",
    "Dott. Marco Galli - Ortopedia e Traumatologia",
  ], { dossiers: ["ginocchio"], addedAgo: 215,
    synthesis: "Visita ortopedica per un dolore al ginocchio destro dopo una caduta: lieve versamento, instabilita dei legamenti. Il medico consiglia una risonanza e un ciclo di fisioterapia, con controllo dopo otto settimane." }),
  {
    key: "rm-ginocchio", kind: "image", title: "Risonanza magnetica ginocchio", category: "Salute", issuer: "Centro Diagnostico Aurora",
    dossiers: ["ginocchio"], addedAgo: 190, picture: { caption: "RM ginocchio destro - 28/03/2026", hue: ["#33415c", "#0b132b"] }, reading: "none",
    notes: "Il CD con le immagini e' nel cassetto dei documenti medici.",
  },
  pdf("fattura-fisio", "Fattura fisioterapia", "Salute", "Studio Fisio Plus", [
    "Fattura n. 201 del 30/04/2026",
    "Ciclo di 10 sedute di fisioterapia",
    "Totale: 480,00 EUR - detraibile 19%",
  ], { dossiers: ["ginocchio"], addedAgo: 160, fields: { importo_totale: "480,00" } }),
  pdf("ricetta", "Ricetta farmaci ginocchio", "Salute", "Dott. Galli", [
    "Ricetta dematerializzata",
    "Antinfiammatorio 50 mg - 2 confezioni",
    "Protettore gastrico",
  ], { dossiers: ["ginocchio"], addedAgo: 210 }),
  pdf("esami", "Esami del sangue 2026", "Salute", "Laboratorio Analisi Rizzoli", [
    "Emocromo completo: nella norma",
    "Colesterolo totale: 198 mg/dl",
    "Glicemia: 92 mg/dl",
    "Vitamina D: 24 ng/ml (lievemente bassa)",
  ], { addedAgo: 75, excludeFromAI: true, notes: "Escluso dalla lettura di Hinthia." }),
  {
    key: "tessera", kind: "image", title: "Tessera sanitaria", category: "Salute", expires: 260, addedAgo: 480,
    picture: { caption: "Tessera sanitaria - Marta Conti", hue: ["#2d6a4f", "#1b4332"] }, reading: "none",
  },

  // ---------- Finanze ----------
  pdf("estratto", "Estratto conto Intesa agosto", "Finanze", "Intesa Sanpaolo", [
    "Conto corrente 100234 - Marta Conti",
    "Saldo iniziale: 4.812,30 EUR",
    "Accrediti: 2.340,00 EUR",
    "Addebiti: 2.775,10 EUR",
    "Saldo finale: 4.377,20 EUR",
  ], { addedAgo: 42 }),
  pdf("pensione", "Estratto contributivo INPS", "Finanze", "INPS", [
    "Posizione assicurativa di Marta Conti",
    "Contributi versati: 31 anni e 4 mesi",
    "Prima data utile di pensione: da verificare con il patronato",
  ], { dossiers: ["pensione"], addedAgo: 33 }),
  pdf("domanda-pensione", "Domanda di pensione (bozza)", "Finanze", "Patronato ACLI", [
    "Bozza di domanda di pensione anticipata",
    "Da completare con la documentazione degli ultimi stipendi",
  ], { dossiers: ["pensione"], addedAgo: 9 }),

  // ---------- Sinistro (fascicolo chiuso) ----------
  pdf("cid", "Constatazione amichevole", "Assicurazioni", "Generali Italia S.p.A.", [
    "Modulo CAI - sinistro del 03/02/2025, Bologna, Via Stalingrado",
    "Veicolo A: Fiat Panda FG 482 KT - Veicolo B: Opel Corsa",
    "Danni al paraurti posteriore",
  ], { dossiers: ["sinistro"], addedAgo: 560, asset: "panda" }),
  pdf("perizia", "Perizia carrozzeria", "Assicurazioni", "Carrozzeria Benelli", [
    "Preventivo di riparazione: 940,00 EUR",
  ], { dossiers: ["sinistro"], addedAgo: 545, asset: "panda", fields: { importo_totale: "940,00" } }),
  pdf("liquidazione", "Liquidazione sinistro", "Assicurazioni", "Generali Italia S.p.A.", [
    "Liquidato il danno per 940,00 EUR",
    "Pratica chiusa il 28/04/2025",
  ], { dossiers: ["sinistro"], addedAgo: 480, asset: "panda", fields: { importo_totale: "940,00" } }),

  // ---------- Successione (fascicolo chiuso) ----------
  pdf("successione", "Dichiarazione di successione Maria Ferri", "Fiscale", "Agenzia delle Entrate", [
    "Dichiarazione di successione - defunta Maria Ferri",
    "Eredi: Marta Conti, Elena Ferri",
    "Presentata il 14/11/2024",
  ], { dossiers: ["successione"], addedAgo: 700 }),

  // ---------- Personale, famiglia, viaggi, lavoro ----------
  {
    key: "carta-identita", kind: "image", title: "Carta d'identita", category: "Personale", expires: 27, addedAgo: 1500,
    picture: { caption: "Carta d'identita - Marta Conti", hue: ["#3a5a98", "#1d3461"] }, reading: "none",
  },
  {
    key: "passaporto", kind: "image", title: "Passaporto", category: "Personale", expires: 320, addedAgo: 1100,
    picture: { caption: "Passaporto - Marta Conti", hue: ["#7a1f2b", "#3d0f15"] }, reading: "none",
  },
  {
    key: "foto-ferragosto", kind: "image", title: "Ferragosto a Viareggio", category: "Famiglia", addedAgo: 60,
    picture: { caption: "Tutti insieme, Ferragosto", hue: ["#ffb347", "#e8505b"] }, reading: "none",
    notes: "La foto che Giulia vuole stampare.",
  },
  {
    key: "ragu", kind: "note", title: "La ricetta del ragu della nonna", category: "Famiglia", addedAgo: 300,
    body: "Il ragu della nonna Rosa\n\nUna cipolla, una carota e una costa di sedano tritate finissime.\nSoffriggere piano nell'olio finche non sono morbide.\nAggiungere 300 g di macinato misto e farlo rosolare bene.\nSfumare col vino rosso, poi la passata e un pezzo di scorza di limone.\nCuocere due ore e mezza a fuoco bassissimo, mescolando ogni tanto.\n\nIl segreto: un cucchiaino di zucchero e tanta pazienza. Lo faceva sempre la domenica, e la casa profumava per tutto il giorno.",
  },
  {
    key: "auguri", kind: "audio", title: "Auguri a Giulia", category: "Famiglia", addedAgo: 100, reading: "none",
    notes: "Registrato per i suoi 18 anni, da mettere in una capsula.",
  },
  {
    key: "chiavi", kind: "note", title: "Dove si trova tutto", category: "Account", addedAgo: 250,
    body: "Chiavi di scorta: cassetto dell'ingresso, scatola blu.\nChiave del box e della cantina: appese dietro la porta della cucina.\nCassaforte in camera: combinazione scritta nella busta nel libro di cucina.\nDocumenti di casa e dell'auto: cartella verde nello studio.\nPer qualunque dubbio chiedere a Paolo o a Elena.",
  },
  {
    key: "inps-accesso", kind: "note", title: "Come accedere al portale INPS", category: "Account", addedAgo: 180,
    body: "Entrare da inps.it con SPID (Poste) oppure con la CIE.\nNel menu 'Fascicolo previdenziale' ci sono contributi e simulazione pensione.\nPer il patronato: appuntamento con Anna, ACLI di Via Marconi.",
  },
  pdf("lavoro", "Lettera di assunzione 2019", "Lavoro", "Studio Ferretti & Associati", [
    "Assunzione a tempo indeterminato - livello 4",
    "Data di inizio: 01/09/2019",
    "CCNL Studi professionali",
  ], { addedAgo: 1300 }),
  pdf("busta-paga", "Busta paga settembre", "Lavoro", "Studio Ferretti & Associati", [
    "Retribuzione lorda: 2.930,00 EUR",
    "Netto in busta: 1.988,00 EUR",
  ], { addedAgo: 12, fields: { importo_totale: "1.988,00" } }),
  pdf("lisbona", "Biglietti aerei Lisbona", "Viaggi", "TAP Air Portugal", [
    "Bologna - Lisbona - Bologna",
    "Passeggeri: Marta Conti, Paolo Conti",
    "Partenza: {scad}",
  ], { expires: 61, addedAgo: 28, fields: { importo_totale: "412,00" } }),
  pdf("hotel", "Prenotazione hotel Lisbona", "Viaggi", "Booking.com", [
    "Hotel Alfama - 4 notti",
    "Cancellazione gratuita fino a 7 giorni prima",
  ], { expires: 54, addedAgo: 27, fields: { importo_totale: "520,00" } }),

  // ---------- Senza categoria, non letti, ----------
  {
    key: "appunti", kind: "note", title: "Appunti vari", category: null, addedAgo: 5,
    body: "Ricordarsi: chiamare il commercialista, rinnovare la tessera della palestra, prenotare il controllo dal dentista.",
  },
  {
    key: "scan", kind: "image", title: "scan_0042.jpg", category: null, addedAgo: 3, reading: "unread",
    picture: { caption: "Scansione da leggere", hue: ["#bfc6ce", "#8a949f"] },
  },
  pdf("non-letto", "Ricevuta senza testo", null, "Sconosciuto", ["Scansione di una ricevuta"], { addedAgo: 2, reading: "unread" }),

  // ---------- Cestino ----------
  pdf("duplicato", "Fattura piastrelle (copia)", "Casa", "Ceramiche del Tirreno", ["Duplicato"], { addedAgo: 50, trashed: true, asset: "casa-roma" }),
  {
    key: "sfocata", kind: "image", title: "Foto sfocata", category: "Famiglia", addedAgo: 70, trashed: true,
    picture: { caption: "Foto sfocata", hue: ["#9aa5b1", "#6b7786"] }, reading: "none",
  },
];
