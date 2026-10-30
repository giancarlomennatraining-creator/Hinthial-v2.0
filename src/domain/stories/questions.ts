/**
 * "Raccontami": le domande con cui Silva fa raccontare ciò che sai e che non sta in nessun documento. Raccolta scritta a
 * mano, senza rete e senza AI: le risposte diventano note in Archivio (categoria "Racconti"), e una domanda è "fatta"
 * quando esiste una nota con quel titolo. Puro.
 */

export interface StoryTheme {
  id: string;
  name: string;
  /** Una frase che dice a cosa servono le domande di questo tema. */
  intro: string;
  questions: string[];
}

/** La categoria dell'Archivio in cui finiscono i racconti. */
export const STORIES_CATEGORY = { name: "Racconti", icon: "📖" } as const;

export const STORY_THEMES: StoryTheme[] = [
  {
    id: "storia",
    name: "La mia storia",
    intro: "Chi sei stato e da dove vieni, per chi vorrà saperlo un giorno.",
    questions: [
      "Dove sei nato e com'era il posto in cui sei cresciuto?",
      "Qual è il tuo ricordo più bello da bambino?",
      "Chi ha contato di più nella tua vita, e perché?",
      "Qual è stato il momento che ti ha cambiato di più?",
    ],
  },
  {
    id: "per-chi-amo",
    name: "Per chi amo",
    intro: "Quello che vorresti dire alle persone a cui tieni, finché hai modo di dirlo bene.",
    questions: [
      "Cosa vorresti che i tuoi figli sapessero di te?",
      "Un consiglio che avresti voluto ricevere a vent'anni",
      "Una cosa che non hai mai detto a qualcuno a cui tieni",
      "Di cosa sei più orgoglioso, e di chi?",
    ],
  },
  {
    id: "famiglia",
    name: "La mia famiglia",
    intro: "Le cose che sai solo tu e che si perdono quando non c'è più chi le racconta.",
    questions: [
      "Una ricetta di famiglia: gli ingredienti, e come si fa davvero",
      "Una tradizione che vorresti non andasse persa",
      "Cosa sai dei tuoi nonni che nessun altro sa?",
      "Una storia di famiglia che si racconta sempre a tavola",
    ],
  },
  {
    id: "come-funziona",
    name: "Come funzionano le cose",
    intro: "Le istruzioni che oggi hai in testa e che qualcuno dovrà trovare. Niente password: servono altri posti per quelle.",
    questions: [
      "Come si gestisce la casa: contatori, caldaia, a chi chiamare per le riparazioni",
      "Dove sono le cose importanti e come si arriva a prenderle",
      "Le persone di cui ci si può fidare: medico, commercialista, avvocato, amici",
      "Cosa va fatto ogni anno, e in che mese",
    ],
  },
];

export const ALL_STORY_QUESTIONS: { theme: StoryTheme; question: string }[] = STORY_THEMES.flatMap((theme) =>
  theme.questions.map((question) => ({ theme, question })),
);

/** Il confronto tra il titolo di una nota e una domanda ignora maiuscole e spazi di troppo. */
export function sameQuestion(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Le domande già raccontate, riconosciute dal titolo delle note (v. domain/stories/repository). */
export function answeredQuestions(storyTitles: string[]): Set<string> {
  const answered = new Set<string>();
  for (const { question } of ALL_STORY_QUESTIONS) {
    if (storyTitles.some((title) => sameQuestion(title, question))) answered.add(question);
  }
  return answered;
}

/**
 * La prossima domanda da proporre: la prima non ancora raccontata, nel tema indicato se c'è ancora qualcosa da dire lì,
 * altrimenti nel primo tema che ne ha. Con `after` (saltare la domanda corrente) si riparte da quella che la segue, in
 * giro: saltare non riporta mai alla stessa domanda finché ce ne sono altre. Null se le ha raccontate tutte.
 */
export function nextQuestion(
  answered: Set<string>,
  preferredThemeId?: string,
  after?: string,
): { theme: StoryTheme; question: string } | null {
  const open = ALL_STORY_QUESTIONS.filter((q) => !answered.has(q.question));
  if (open.length === 0) return null;

  if (after !== undefined) {
    const position = ALL_STORY_QUESTIONS.findIndex((q) => q.question === after);
    const following = open.find((q) => ALL_STORY_QUESTIONS.indexOf(q) > position);
    return following ?? open.find((q) => q.question !== after) ?? open[0];
  }

  const inTheme = preferredThemeId ? open.find((q) => q.theme.id === preferredThemeId) : undefined;
  return inTheme ?? open[0];
}

export function storyProgress(answered: Set<string>): { done: number; total: number } {
  return { done: answered.size, total: ALL_STORY_QUESTIONS.length };
}
