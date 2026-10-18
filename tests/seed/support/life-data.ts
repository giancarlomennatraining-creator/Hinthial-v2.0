/**
 * Il resto del profilo demo di Marta Conti: persone, beni, scadenze, fascicoli, capsule e racconti. Solo dati (v.
 * demo.seed.ts). Le date sono giorni da oggi, così il profilo resta "vivo" a ogni nuova semina.
 */

export const CUSTOM_CATEGORIES = [
  { name: "Famiglia", icon: "👨‍👩‍👧" },
  { name: "Lavoro", icon: "💼" },
  { name: "Viaggi", icon: "✈️" },
];

export const ASSETS = [
  { key: "casa-roma", name: "Casa di Via Roma 12, Bologna", category: "Casa", legacyNote: "È la casa in cui abitiamo. Resta a Paolo; i ragazzi possono restarci finché serve. Le chiavi di scorta sono nel cassetto dell'ingresso." },
  { key: "casa-viareggio", name: "Appartamento a Viareggio", category: "Casa", legacyNote: "La casa al mare: da dividere fra Luca e Giulia, ma solo se vogliono tenerla. Il mutuo è intestato a me e a Paolo." },
  { key: "panda", name: "Fiat Panda", category: "Veicoli", legacyNote: "" },
  { key: "vespa", name: "Vespa Primavera", category: "Veicoli", legacyNote: "A Giulia, se la vuole." },
  { key: "conto", name: "Conto corrente Intesa", category: "Finanze", legacyNote: "Cointestato con Paolo. Per ogni dubbio, la banca di Via Marconi." },
  { key: "polizze", name: "Polizza vita Reale Mutua", category: "Assicurazioni", legacyNote: "I beneficiari sono scritti nella polizza: Paolo, Luca e Giulia." },
  { key: "box", name: "Box auto n. 14", category: "Veicoli", legacyNote: "" },
];

export interface FriendSpec {
  key: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  /** Persona che ha già detto sì (amicizia accettata). */
  friend?: boolean;
  guardian?: boolean;
  revoked?: boolean;
  /** Ha un account Hinthial collegato (l'account demo B). */
  linkedToB?: boolean;
  addedAgo: number;
}

export const FRIENDS: FriendSpec[] = [
  { key: "paolo", name: "Paolo Conti", firstName: "Paolo", lastName: "Conti", email: "paolo.conti.demo@mailinator.com", role: "Marito", friend: true, guardian: true, linkedToB: true, addedAgo: 400 },
  { key: "luca", name: "Luca Conti", firstName: "Luca", lastName: "Conti", email: "luca.conti@esempio.it", role: "Figlio", friend: true, guardian: true, addedAgo: 380 },
  { key: "giulia", name: "Giulia Conti", firstName: "Giulia", lastName: "Conti", email: "giulia.conti@esempio.it", role: "Figlia", addedAgo: 380 },
  { key: "elena", name: "Elena Ferri", firstName: "Elena", lastName: "Ferri", email: "elena.ferri@esempio.it", role: "Sorella", friend: true, guardian: true, addedAgo: 350 },
  { key: "rosa", name: "Rosa Bianchi", firstName: "Rosa", lastName: "Bianchi", email: "rosa.bianchi@esempio.it", role: "Mamma", addedAgo: 300 },
  { key: "galli", name: "Marco Galli", firstName: "Marco", lastName: "Galli", email: "marco.galli@studiogalli.it", role: "Medico di famiglia", addedAgo: 220 },
  { key: "neri", name: "Silvia Neri", firstName: "Silvia", lastName: "Neri", email: "s.neri@notaioneri.it", role: "Notaio", addedAgo: 160 },
  { key: "carla", name: "Carla Rinaldi", firstName: "Carla", lastName: "Rinaldi", email: "carla.rinaldi@esempio.it", role: "Amica", revoked: true, addedAgo: 500 },
  { key: "bruno", name: "Bruno Rossi", firstName: "Bruno", lastName: "Rossi", email: "bruno.rossi@esempio.it", role: "Vicino di casa", addedAgo: 90 },
];

export interface ReminderSpec {
  title: string;
  due: number;
  done?: boolean;
  doc?: string;
  asset?: string;
}

export const REMINDERS: ReminderSpec[] = [
  { title: "Chiamare il commercialista", due: 0 },
  { title: "Ritirare le piastrelle del bagno", due: 1 },
  { title: "Pagare la TARI, seconda rata", due: 3, doc: "tari", asset: "casa-roma" },
  { title: "Revisione della Panda", due: 11, doc: "revisione-panda", asset: "panda" },
  { title: "Rinnovo della polizza sanitaria", due: 18, doc: "pol-sanitaria" },
  { title: "Disdetta o cambio della fibra TIM", due: 21, doc: "fibra" },
  { title: "Controllo ortopedico dal dott. Galli", due: 24 },
  { title: "Rinnovo della carta d'identità", due: 27, doc: "carta-identita" },
  { title: "Rinnovo della polizza auto Generali", due: 34, doc: "pol-auto", asset: "panda" },
  { title: "Saldo IMU di Viareggio", due: 46, doc: "imu", asset: "casa-viareggio" },
  { title: "Volo per Lisbona", due: 61, doc: "lisbona" },
  { title: "Compleanno di Giulia", due: 80 },
  { title: "Anniversario di matrimonio", due: 120 },
  { title: "Pagare il bollo della Panda", due: -9, doc: "bollo-panda", asset: "panda" },
  { title: "Prenotare il dentista", due: -2 },
  { title: "Pagare l'acconto all'idraulico", due: -40, done: true, doc: "fattura-idraulico" },
  { title: "Consegnare il 730 al CAF", due: -120, done: true, doc: "730" },
  { title: "Prenotare la risonanza al ginocchio", due: -190, done: true },
  { title: "Pagare l'IMU di giugno", due: -125, done: true, asset: "casa-viareggio" },
];

export interface DossierSpec {
  key: string;
  title: string;
  description: string;
  /** Nomi delle fasi (un preset) e quella in cui si è. */
  phases?: { names: string[]; current: number };
  expected?: { label: string; done?: boolean }[];
  steps?: { text: string; due?: number; done?: boolean }[];
  people?: { name: string; role: string }[];
  summary?: string;
  closed?: boolean;
  addedAgo: number;
}

export const DOSSIERS: DossierSpec[] = [
  {
    key: "ginocchio", title: "Intervento al ginocchio", addedAgo: 215,
    description: "Visite, esami, riabilitazione e controlli dopo la caduta di marzo.",
    phases: { names: ["Visite", "Esami", "Cura", "Controlli"], current: 2 },
    expected: [
      { label: "Referto visita ortopedica", done: true },
      { label: "Risonanza magnetica", done: true },
      { label: "Fattura fisioterapia", done: true },
      { label: "Certificato di fine cura" },
    ],
    steps: [
      { text: "Ultime quattro sedute di fisioterapia", due: 9 },
      { text: "Controllo ortopedico", due: 24 },
      { text: "Chiedere il certificato di fine cura" },
      { text: "Prenotare la risonanza", done: true },
    ],
    people: [{ name: "Marco Galli", role: "Ortopedico" }, { name: "Studio Fisio Plus", role: "Fisioterapia" }],
    summary: "Dopo la caduta di marzo la visita ortopedica ha rilevato un lieve versamento al ginocchio destro e una certa instabilita dei legamenti. Sono seguite la risonanza magnetica e un ciclo di dieci sedute di fisioterapia (480 euro, detraibili). Mancano le ultime sedute e il controllo ortopedico fra circa tre settimane.",
  },
  {
    key: "viareggio", title: "Acquisto casa a Viareggio", addedAgo: 165,
    description: "Compravendita, mutuo e pratiche dell'appartamento in Via Fratti.",
    phases: { names: ["Trattativa", "Proposta", "Mutuo", "Rogito", "Dopo il rogito"], current: 4 },
    expected: [
      { label: "Atto di acquisto", done: true },
      { label: "Contratto di mutuo", done: true },
      { label: "Visura catastale", done: true },
      { label: "Voltura delle utenze" },
    ],
    steps: [
      { text: "Voltura di luce e gas", due: 6 },
      { text: "Saldo IMU", due: 46 },
      { text: "Portare l'atto in banca", done: true },
    ],
    people: [{ name: "Silvia Neri", role: "Notaio" }, { name: "Giulio Bassi", role: "Agente immobiliare" }],
    summary: "L'appartamento di Via Fratti a Viareggio e' stato acquistato il 22 maggio 2025 a 215.000 euro, con un mutuo di 150.000 euro a tasso fisso su 25 anni (rata di 724,20 euro). Restano la voltura delle utenze e il saldo IMU entro dicembre.",
  },
  {
    key: "bagno", title: "Ristrutturazione bagno", addedAgo: 58,
    description: "Il bagno principale di Via Roma: preventivi, lavori e spese.",
    phases: { names: ["Preventivi", "Permessi", "Lavori", "Collaudo"], current: 2 },
    expected: [
      { label: "Preventivo", done: true },
      { label: "Fattura idraulico", done: true },
      { label: "Fattura piastrelle", done: true },
      { label: "Collaudo dell'impianto" },
    ],
    steps: [
      { text: "Scegliere i sanitari", due: -4, done: true },
      { text: "Collaudo finale con l'idraulico", due: 16 },
      { text: "Pagare il saldo all'impresa", due: 30 },
    ],
    people: [{ name: "Davide Verdi", role: "Capocantiere" }, { name: "Idraulica Moretti", role: "Impianto idraulico" }],
  },
  {
    key: "pensione", title: "Pratica pensione", addedAgo: 35,
    description: "Capire quando e come andare in pensione.",
    expected: [{ label: "Estratto contributivo", done: true }, { label: "Ultimi cedolini" }, { label: "Domanda" }],
    steps: [{ text: "Appuntamento al patronato ACLI", due: 13 }, { text: "Portare gli ultimi cedolini" }],
    people: [{ name: "Anna", role: "Patronato ACLI" }],
  },
  {
    key: "sinistro", title: "Sinistro auto 2025", addedAgo: 575, closed: true,
    description: "Il tamponamento di febbraio in Via Stalingrado.",
    phases: { names: ["Denuncia", "Perizia", "Liquidazione", "Chiusura"], current: 3 },
    expected: [{ label: "Constatazione amichevole", done: true }, { label: "Perizia", done: true }, { label: "Liquidazione", done: true }],
    people: [{ name: "Carrozzeria Benelli", role: "Riparazione" }],
    summary: "Sinistro del 3 febbraio 2025 con danni al paraurti posteriore della Panda. Perizia di 940 euro, interamente liquidata da Generali; pratica chiusa il 28 aprile 2025.",
  },
  {
    key: "successione", title: "Successione zia Maria", addedAgo: 710, closed: true,
    description: "Le pratiche dell'eredita di zia Maria Ferri.",
    expected: [{ label: "Dichiarazione di successione", done: true }],
  },
  { key: "idee", title: "Idee per i vent'anni di Giulia", addedAgo: 8, description: "Una lista di cose da non dimenticare." },
];

export interface CapsuleSpec {
  key: string;
  title: string;
  content: string;
  contentStyle: "simple" | "handwritten";
  effect: "zoom" | "hold" | "deck" | "light" | "discreet";
  friends: string[];
  /** Giorni da oggi all'apertura. */
  open: number;
  /** "draft" resta bozza; "ready" la chiude; "shared" la chiude e la condivide con chi ha un account collegato. */
  state: "draft" | "ready" | "shared";
  legacy?: boolean;
  docs?: string[];
  audio?: boolean;
  addedAgo: number;
}

export const CAPSULES: CapsuleSpec[] = [
  {
    key: "giulia20", title: "Per Giulia, per i tuoi vent'anni", state: "draft", open: 120, friends: ["giulia"], effect: "hold", contentStyle: "handwritten", addedAgo: 12,
    content: "Cara Giulia,\n\nquando leggerai questa lettera avrai vent'anni e io sicuramente non avro' smesso di preoccuparmi per te.\n\nVoglio dirti tre cose. La prima: non avere fretta di sapere chi sei, lo capirai strada facendo. La seconda: chiama la nonna, anche quando sei stanca. La terza: la vespa e' tua, ma metti il casco.\n\nSono fiera di te piu' di quanto riesca a dirti.\n\nMamma",
    docs: ["foto-ferragosto", "auguri"],
  },
  {
    key: "luca-casa", title: "Per Luca: dove trovare tutto", state: "ready", open: 30, friends: ["luca"], effect: "zoom", contentStyle: "simple", legacy: true, addedAgo: 80,
    content: "Luca,\n\nse stai leggendo questo e' perche' serve sapere dove stanno le cose. Ti ho lasciato l'elenco: chiavi, cassaforte, documenti dell'auto, la cartella verde nello studio. Chiedi a Paolo e a Elena, sanno tutto.\n\nNon avere paura di chiedere aiuto.",
    docs: ["chiavi"],
  },
  {
    key: "paolo-30", title: "Per Paolo: i nostri trent'anni", state: "shared", open: -3, friends: ["paolo"], effect: "light", contentStyle: "handwritten", addedAgo: 40,
    content: "Paolo,\n\ntrent'anni fa mi hai chiesto di ballare e io ho detto di no. Per fortuna hai insistito.\n\nGrazie per ogni cosa piccola: il caffe' la mattina, la pazienza con la mia memoria, il modo in cui ridi quando racconto sempre la stessa storia.\n\nBuon anniversario, amore mio.",
    docs: ["foto-ferragosto"],
  },
  {
    key: "natale", title: "Auguri di Natale", state: "shared", open: 67, friends: ["paolo", "luca", "giulia"], effect: "deck", contentStyle: "simple", addedAgo: 20,
    content: "Buon Natale a tutti voi.\n\nQuest'anno tavola grande e ragu' della nonna. Portate fame e buonumore.\n\nVi voglio bene.",
  },
  {
    key: "me-stessa", title: "Una lettera per me, fra cinque anni", state: "draft", open: 1800, friends: [], effect: "discreet", contentStyle: "handwritten", addedAgo: 6,
    content: "Cara Marta di fra cinque anni,\n\nSpero che il ginocchio sia a posto, che tu abbia fatto il viaggio in Portogallo e che abbia finalmente imparato a dire di no.\n\nTi ricordi cosa volevi fare? Falla ora.",
  },
  {
    key: "elena", title: "Per Elena", state: "ready", open: 200, friends: ["elena"], effect: "discreet", contentStyle: "handwritten", legacy: true, audio: true, addedAgo: 55,
    content: "Elena,\n\nti ho registrato due parole perche' la voce si porta dietro piu' di quanto si possa scrivere. Ascoltala quando ne hai voglia.\n\nSorella mia, grazie per tutte le volte che ci sei stata.",
  },
  {
    key: "ragu", title: "Il ragu' della nonna, per Giulia", state: "draft", open: 365, friends: ["giulia"], effect: "light", contentStyle: "simple", addedAgo: 10,
    content: "Giulia, la ricetta e' qui sotto. Non guardare il tempo di cottura: l'unica regola e' il profumo.",
    docs: ["ragu"],
  },
  {
    key: "se-succede", title: "Se mi succede qualcosa", state: "shared", open: 500, friends: ["paolo", "luca", "giulia"], effect: "discreet", contentStyle: "simple", legacy: true, addedAgo: 110,
    content: "A tutti voi,\n\nho cercato di mettere in ordine le cose, per non lasciarvi in mezzo alla confusione. In Hinthial trovate i documenti, i beni e tutto cio' che serve.\n\nVoglio che sappiate che ho avuto una vita piena, e che ogni giorno con voi e' stato la parte migliore.\n\nNon siate tristi troppo a lungo. Cucinate qualcosa insieme.",
    docs: ["chiavi", "pol-vita"],
  },
];

export interface CapsuleFromB {
  title: string;
  content: string;
  open: number;
}

export const CAPSULES_FROM_B: CapsuleFromB[] = [
  { title: "Per Marta: il nostro anniversario", open: -3, content: "Marta,\n\nsono passati trent'anni e continuo a scegliere te. Prenota il tavolo da Nino, quello vicino alla finestra: l'ho gia' fatto io.\n\nPaolo" },
  { title: "Un pensiero per Marta", open: 40, content: "Quando aprirai questa capsula saremo quasi a Natale. Volevo che avessi qualcosa da leggere mentre prepari il ragu'." },
];

/** Una risposta per ogni domanda indicata (tema, indice): le altre restano da fare. */
export const STORY_ANSWERS: { theme: number; index: number; answer: string }[] = [
  { theme: 0, index: 0, answer: "Sono nata a Bologna, in un appartamento con le finestre sul cortile. Dal cortile arrivava sempre odore di bucato e di soffritto. Giocavamo a nascondino tra i garage, e quando faceva buio mia madre si affacciava e fischiava due volte." },
  { theme: 0, index: 1, answer: "L'estate dai nonni a Viareggio: la bicicletta con il cestino, il bagno alle sei di sera quando la spiaggia si svuotava, il gelato alla crema che si scioglieva prima di arrivare a casa." },
  { theme: 0, index: 2, answer: "Mia nonna Rosa, senza dubbio. Mi ha insegnato che la pazienza e' una forma di amore e che un piatto fatto bene non ha bisogno di spiegazioni." },
  { theme: 1, index: 0, answer: "Che non sono mai stata sicura di niente, ma di voi si'. Che ogni volta che esitavo era perche' avevo paura di sbagliare con voi. E che se ho sbagliato, era sempre per troppo amore." },
  { theme: 1, index: 1, answer: "Che non c'e' nessuna fretta. Le cose importanti arrivano comunque, e quelle che non arrivano non erano importanti." },
  { theme: 2, index: 0, answer: "Ragu' di nonna Rosa: una cipolla, una carota, un gambo di sedano, 300 g di macinato misto, mezzo bicchiere di vino rosso, una passata di pomodoro e una scorza di limone. Due ore e mezza a fuoco bassissimo. Lo zucchero e' il segreto, ma non diteglielo." },
  { theme: 2, index: 1, answer: "La tombola del 26 dicembre, con i fagioli per i numeri e il premio che era sempre un panettone. Non perdete la tombola." },
  { theme: 3, index: 0, answer: "Il contatore dell'acqua e' nello sgabuzzino, la caldaia ha la manutenzione ogni ottobre (il numero del tecnico e' sul frigorifero). Per le riparazioni chiamate Bruno, il vicino: sa tutto della casa." },
  { theme: 3, index: 1, answer: "Chiavi di scorta nel cassetto dell'ingresso, i documenti nella cartella verde dello studio, la cassaforte in camera dietro la scarpiera." },
  { theme: 3, index: 3, answer: "A gennaio il 730, a marzo la revisione dell'impianto di riscaldamento, a settembre il rinnovo della polizza auto, a dicembre il saldo IMU." },
];
