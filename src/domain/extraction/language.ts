/**
 * Lingua del testo, rilevata sul dispositivo contando le parole funzionali più comuni --- nessun modello, nessun byte
 * fuori. Copre le lingue con cui un utente italiano ha davvero a che fare; per tutto il resto risponde null (meglio
 * "non so" di una lingua sbagliata: serve a orientare l'analisi, non a decidere qualcosa).
 */

const STOPWORDS: Record<string, readonly string[]> = {
  it: ["il", "lo", "la", "le", "gli", "di", "del", "della", "dei", "delle", "che", "e", "è", "un", "una", "per", "con", "non", "sono", "nel", "nella", "al", "alla", "da", "in", "si", "come", "anche", "più", "ai", "dal", "sul", "questo", "questa"],
  en: ["the", "of", "and", "to", "in", "is", "that", "for", "it", "with", "as", "was", "on", "are", "by", "this", "be", "at", "or", "from", "an", "have", "not", "which", "will", "you", "your"],
  fr: ["le", "la", "les", "de", "des", "du", "et", "en", "un", "une", "que", "est", "pour", "dans", "qui", "sur", "au", "avec", "ne", "pas", "par", "se", "ce", "sont", "vous"],
  de: ["der", "die", "das", "und", "ist", "von", "zu", "den", "mit", "für", "auf", "nicht", "ein", "eine", "dem", "des", "im", "sich", "auch", "es", "wird", "sind", "bei"],
  es: ["el", "la", "los", "las", "de", "del", "y", "en", "un", "una", "que", "es", "por", "con", "para", "se", "no", "al", "como", "su", "más", "este", "esta"],
};

/** Sotto questo numero di parole il campione è troppo piccolo per dire una lingua. */
const MIN_WORDS = 12;

/** La lingua vincente deve avere almeno una volta e mezza i riscontri della seconda, altrimenti è ambigua (es. un testo misto). */
const MIN_LEAD = 1.5;

/** Codice ISO 639-1 della lingua più probabile, o null se il testo è troppo breve o ambiguo. */
export function detectLanguage(text: string): string | null {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < MIN_WORDS) return null;

  const scores = Object.entries(STOPWORDS)
    .map(([language, list]) => {
      const set = new Set(list);
      return { language, hits: words.reduce((sum, word) => sum + (set.has(word) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.hits - a.hits);

  const [best, second] = scores;
  if (best.hits < 3) return null;
  if (second.hits > 0 && best.hits < second.hits * MIN_LEAD) return null;
  return best.language;
}
