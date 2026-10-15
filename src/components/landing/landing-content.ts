/**
 * Contenuti e logica pura della pagina pubblica: i passi del seme, la costellazione d'esempio e le pagine del libro.
 * Niente React e niente DOM, così si provano da soli (v. tests/unit/landing-content.test.ts).
 */

/** Il titolo della pagina; le parole in `HERO_HIGHLIGHT` prendono il colore del marchio. */
export const HERO_TITLE = "Ciò che sai e ciò che hai, alla persona giusta, al momento giusto.";
export const HERO_HIGHLIGHT = new Set(["persona", "giusta,", "momento", "giusto."]);

export interface SeedStep {
  /** La sezione dell'app che questo passo racconta. */
  section: string;
  title: string;
  text: string;
}

/** I quattro passi dell'albero: uno per pilastro, nell'ordine in cui l'albero cresce. */
export const SEED_STEPS: SeedStep[] = [
  {
    section: "Raccontami",
    title: "Si comincia da un seme",
    text: "Un ricordo, una ricetta, un'istruzione. Hinthia ti fa una domanda alla volta e tu rispondi come vuoi, anche con due righe.",
  },
  {
    section: "Archivio",
    title: "Cresce insieme a te",
    text: "Racconti, documenti, beni e istruzioni diventano foglie dello stesso albero. Cifrate sul tuo dispositivo: le puoi leggere solo tu.",
  },
  {
    section: "Amici",
    title: "Scegli per chi",
    text: "Le persone a cui tieni, ciascuna con ciò che stai preparando per lei. Alcune faranno anche da guardiani.",
  },
  {
    section: "Capsule ed Eredità digitale",
    title: "Al momento giusto, arriva",
    text: "Ogni foglia si stacca quando deve: il giorno del matrimonio di Giulia, a Natale per Luca, per Paolo solo se un giorno non risponderai più.",
  },
];

/**
 * Il passo attivo dati i bordi superiori dei passi (in px dalla cima della finestra): l'ultimo che ha superato la soglia.
 * 0 se nessuno l'ha ancora superata (l'albero è solo un seme).
 */
export function activeSeedStep(stepTops: number[], threshold: number): number {
  let step = 0;
  stepTops.forEach((top, i) => {
    if (top < threshold) step = i + 1;
  });
  return step;
}

export interface ConstellationPerson {
  name: string;
  relation: string;
  gift: string;
  /** L'anno in cui la capsula si apre; assente se si apre solo con l'Eredità digitale. */
  year?: number;
  /** Si apre anche (o solo) se un giorno il proprietario non risponde più. */
  legacy?: boolean;
}

export const CONSTELLATION_FIRST_YEAR = 2026;
export const CONSTELLATION_LAST_YEAR = 2045;

/** Una costellazione d'esempio: persone e capsule inventate, dichiarate come tali nella pagina. */
export const CONSTELLATION_PEOPLE: ConstellationPerson[] = [
  { name: "Giulia", relation: "figlia", gift: "Lettera per il matrimonio", year: 2031 },
  { name: "Marta", relation: "sorella · guardiana", gift: "Le foto di Ventotene", year: 2027 },
  { name: "Luca", relation: "amico", gift: "La chitarra e la sua storia", year: 2028 },
  { name: "Paolo", relation: "marito", gift: "Polizze, conti e a chi telefonare", legacy: true },
  { name: "Sofia", relation: "nipote", gift: "Per i tuoi 18 anni", year: 2040 },
  { name: "Andrea", relation: "fratello · guardiano", gift: "Le chiavi della casa al mare", legacy: true },
];

export function isDelivered(person: ConstellationPerson, year: number, legacyTriggered: boolean): boolean {
  return (person.year !== undefined && year >= person.year) || (person.legacy === true && legacyTriggered);
}

/** Lo stato della capsula di una persona, come lo si legge sotto il suo nome. */
export function deliveryStatus(person: ConstellationPerson, year: number, legacyTriggered: boolean): string {
  if (isDelivered(person, year, legacyTriggered)) {
    return person.year !== undefined && year >= person.year
      ? `Aperta nel ${person.year}`
      : "Consegnata dall'Eredità digitale";
  }
  return person.year !== undefined ? `Si apre nel ${person.year}` : "Solo se non rispondi più";
}

export interface BookPage {
  tag: string;
  title: string;
  body: string;
  meta: string;
}

/** Le pagine del libro: un racconto, una capsula, un'istruzione, l'eredità. */
export const BOOK_PAGES: BookPage[] = [
  {
    tag: "Raccontami · La mia storia",
    title: "Dove sei nato e com'era il posto in cui sei cresciuto?",
    body: "A Gubbio, in una casa con le persiane verdi. D'estate dormivamo con le finestre aperte e all'alba si sentivano le campane.",
    meta: "Racconto · 12 marzo 2026",
  },
  {
    tag: "Capsula · per Giulia",
    title: "Il giorno del tuo matrimonio",
    body: "Amore mio, se stai leggendo oggi ti sposi. Ti ho lasciato la ricetta del ragù della nonna: non metterci mai la cipolla.",
    meta: "Si apre il 14 giugno 2031",
  },
  {
    tag: "Raccontami · Come funzionano le cose",
    title: "La caldaia",
    body: "Il libretto è nel cassetto sotto il forno. Se va in blocco tieni premuto il tasto reset per cinque secondi. Il tecnico è Bruno.",
    meta: "Istruzione · per tutta la famiglia",
  },
  {
    tag: "Eredità digitale",
    title: "Se un giorno non risponderò più",
    body: "Marta e Andrea sono i miei guardiani. Le lettere per i ragazzi si apriranno solo dopo che loro avranno provato a cercarmi.",
    meta: "Ritmo: Normale · circa 7 mesi",
  },
];

const CIPHER_GLYPHS = "abcdef0123456789+/=ABCDEFxyz";

/**
 * Un "testo cifrato" finto ma stabile, della stessa lunghezza dell'originale: solo per mostrare come appare un contenuto a chi
 * non ha la chiave. Non è cifratura (quella vera è AES-GCM, v. lib/crypto) e non va mai usato al suo posto.
 */
export function pseudoCipher(text: string): string {
  let hash = 0;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i) + i) >>> 0;
    out += CIPHER_GLYPHS[hash % CIPHER_GLYPHS.length];
  }
  return out;
}

/** Un carattere a caso tra quelli del testo cifrato, per l'effetto di decifratura. */
export function randomGlyph(): string {
  return CIPHER_GLYPHS[Math.floor(Math.random() * CIPHER_GLYPHS.length)];
}

/** Una riga di byte esadecimali, stabile per indice (uguale sul server e nel browser). */
export function hexLine(index: number): string {
  const groups: string[] = [];
  let seed = Math.imul(index + 1, 2654435761) >>> 0;
  for (let g = 0; g < 6; g++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    groups.push((seed & 0xffffff).toString(16).padStart(6, "0"));
  }
  return groups.join(" ");
}
