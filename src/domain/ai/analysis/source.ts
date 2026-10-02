/**
 * Il punto del testo letto da cui viene un dato: il segmento indicato dalla provenienza, con la citazione da evidenziare.
 * La citazione è stata verificata con un confronto tollerante agli spazi (v. quoteAppearsIn), quindi si cerca allo stesso modo.
 */

export interface SourceExcerpt {
  before: string;
  match: string;
  after: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Divide `text` attorno alla citazione, o restituisce null se non c'è (il testo può essere cambiato dopo la lettura). */
export function splitAroundQuote(text: string, quote: string): SourceExcerpt | null {
  const words = quote.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const found = new RegExp(words.map(escapeRegExp).join("\\s+"), "i").exec(text);
  if (!found) return null;
  return {
    before: text.slice(0, found.index),
    match: found[0],
    after: text.slice(found.index + found[0].length),
  };
}
