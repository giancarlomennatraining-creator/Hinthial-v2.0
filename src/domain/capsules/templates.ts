/**
 * I modelli di capsula: partire da un'occasione ("Per i tuoi 18 anni", "Una lettera a me stesso") invece che da un foglio
 * bianco. Un modello propone un titolo, una data di apertura (se ha senso averne una), qualche spunto per cominciare a
 * scrivere e gli allegati che di solito ci stanno bene. È solo un punto di partenza: tutto si può cambiare prima di creare.
 * Come i modelli di fascicolo (v. domain/dossiers/templates.ts), sono solo dati: nessuna rete, nessun database, e nessuna
 * intelligenza artificiale --- il testo di una capsula non esce mai dal dispositivo per colpa di un modello. Puro.
 */

export interface CapsuleTemplate {
  id: string;
  name: string;
  description: string;
  /** Il colore del modello e la sua tinta chiara, per la scheda. */
  color: string;
  tint: string;
  /** Il tracciato dell'icona (viewBox 24, linee). */
  icon: string;
  /** Il titolo che compila da solo il campo (si può cambiare). */
  title: string;
  /** Tra quanti anni suggerire l'apertura, o null se dipende dalla persona (es. i 18 anni di qualcuno). */
  openAfterYears: number | null;
  /** Come si racconta l'apertura nella scheda del modello. */
  openHint: string;
  /** Domande da cui partire a scrivere: ognuna, toccata, entra nella lettera. */
  prompts: string[];
  /** Cosa di solito ci sta bene come allegato --- un'idea, mai un obbligo. */
  attachmentIdeas: string[];
}

export const CAPSULE_TEMPLATES: CapsuleTemplate[] = [
  {
    id: "diciotto",
    name: "Per i tuoi 18 anni",
    description: "Una lettera per quando diventi grande.",
    color: "#2b4fc4",
    tint: "#e8edfc",
    icon: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
    title: "Per i tuoi 18 anni",
    openAfterYears: null,
    openHint: "Scegli tu la data del suo 18° compleanno.",
    prompts: [
      "Il ricordo più bello di te da piccolo",
      "Cosa spero per te",
      "Un consiglio che avrei voluto ricevere",
      "Una cosa che non ti ho mai detto",
    ],
    attachmentIdeas: ["Una foto di quando era piccolo", "Un audio con la tua voce"],
  },
  {
    id: "me-stesso",
    name: "Al me stesso di domani",
    description: "Una lettera da aprire tra qualche anno.",
    color: "#6d4fc4",
    tint: "#eeeafa",
    icon: "M6 3h12 M6 21h12 M7 3c0 5 5 6 5 9s-5 4-5 9 M17 3c0 5-5 6-5 9s5 4 5 9",
    title: "Una lettera a me stesso",
    openAfterYears: 5,
    openHint: "Tra 5 anni, alle 10:00. Puoi cambiare quando vuoi.",
    prompts: ["Come sto oggi", "Cosa mi preoccupa", "Cosa spero di aver fatto", "Cosa voglio ricordarmi"],
    attachmentIdeas: ["Una foto di oggi", "Una canzone di questo periodo"],
  },
  {
    id: "bambino",
    name: "Per un bambino che nasce",
    description: "Un pensiero da aprire al suo primo compleanno.",
    color: "#c2417a",
    tint: "#fae6ef",
    icon: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M9.5 8.5h.01 M14.5 8.5h.01 M10 11c1 1 3 1 4 0 M8 21l1-3.5 M16 21l-1-3.5",
    title: "Per il tuo primo compleanno",
    openAfterYears: 1,
    openHint: "Tra 1 anno, alle 10:00. Puoi cambiare quando vuoi.",
    prompts: ["Com'è il mondo oggi", "Come sei adesso", "Cosa vorrei che imparassi", "Il giorno in cui sei nato"],
    attachmentIdeas: ["Una foto dell'anno", "La sua altezza, segnata sul muro"],
  },
  {
    id: "matrimonio",
    name: "Per un matrimonio",
    description: "Da aprire il giorno delle nozze.",
    color: "#0f8b8d",
    tint: "#e0f2f2",
    icon: "M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z M9 6l3-3 3 3-3 3z",
    title: "Per il vostro giorno",
    openAfterYears: null,
    openHint: "Scegli tu la data delle nozze.",
    prompts: ["Come vi ho visti crescere", "Un augurio per voi due", "Un ricordo che vi riguarda"],
    attachmentIdeas: ["Una foto di voi", "Un biglietto scritto a mano"],
  },
  {
    id: "ricordi",
    name: "Ricette e ricordi di famiglia",
    description: "Le cose che solo tu sai.",
    color: "#a9731a",
    tint: "#f8efdb",
    icon: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5",
    title: "Le ricette di famiglia",
    openAfterYears: null,
    openHint: "Nessuna data suggerita: dipende da cosa lasci.",
    prompts: ["La ricetta, passo per passo", "Chi me l'ha insegnata", "Quando la preparavamo"],
    attachmentIdeas: ["Una foto del piatto", "Un audio mentre cucini"],
  },
  {
    id: "se-mi-succede",
    name: "Se mi succede qualcosa",
    description: "Per chi resta.",
    color: "#b3302f",
    tint: "#fbe6e6",
    icon: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    title: "Per chi resta",
    openAfterYears: 30,
    openHint:
      "Si apre prima, se scatta l'eredità digitale (la attivi da Impostazioni). La data tra 30 anni è solo il limite massimo.",
    prompts: ["Cosa voglio che tu sappia", "Dove trovare le cose importanti", "Cosa ti chiedo di fare", "Un ultimo saluto"],
    attachmentIdeas: ["L'elenco delle cose da fare", "Un messaggio con la tua voce"],
  },
];

/** Gli spunti di chi parte da zero (o modifica una bozza): validi per quasi ogni lettera. */
export const GENERIC_PROMPTS: string[] = [
  "Un ricordo che ho di te",
  "Cosa spero per te",
  "Un consiglio che avrei voluto ricevere",
  "Una cosa che non ti ho mai detto",
];

export function templateMeta(template: CapsuleTemplate): string {
  const count = template.prompts.length;
  return `${count} spunti per scrivere`;
}

export function promptsFor(template: CapsuleTemplate | null): string[] {
  return template ? template.prompts : GENERIC_PROMPTS;
}

/** La data di apertura suggerita (ISO, UTC): `openAfterYears` anni da `now`, alle 10:00 ora locale. Null se il modello non ne propone una. */
export function suggestedOpenAt(template: CapsuleTemplate, now: Date): string | null {
  if (template.openAfterYears === null) return null;
  const date = new Date(now);
  date.setFullYear(date.getFullYear() + template.openAfterYears);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

/** Se lo spunto è già nella lettera (v. appendPrompt: entra come "spunto: "). */
export function isPromptUsed(content: string, prompt: string): boolean {
  return content.includes(`${prompt}:`);
}

/** Aggiunge lo spunto in fondo alla lettera, come una nuova riga da completare ("Cosa spero per te: "). */
export function appendPrompt(content: string, prompt: string): string {
  const trimmed = content.replace(/\s+$/, "");
  const line = `${prompt}: `;
  return trimmed ? `${trimmed}\n\n${line}` : line;
}
