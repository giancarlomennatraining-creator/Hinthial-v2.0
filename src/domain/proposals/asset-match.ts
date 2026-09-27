import type { AssetListItem } from "@/domain/assets/types";

/**
 * FASE 19b: a quale bene si riferisce il documento --- i beni hanno spesso un identificativo unico (targa, IBAN,
 * polizza), e trovarlo è una certezza, non una somiglianza. Trappola: nomi generici come "Casa"/"Auto" agganciano
 * qualunque testo che li nomini, stesso errore evitato per le categorie --- su quelli si sta zitti.
 */

/** Sotto questa lunghezza un nome intero non è abbastanza distintivo. */
const MIN_NAME_CHARS = 10;
/** E nemmeno lo è una parola sola: "Casa", "Appartamento", "Motorino". */
const MIN_NAME_WORDS = 2;
/** Un identificativo: abbastanza lungo, e con almeno una cifra dentro. */
const MIN_IDENTIFIER_CHARS = 5;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Si tolgono i separatori interni così "AB 123 CD" e "AB123CD" diventano la stessa cosa.
    .replace(/[-_./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Oltre questa lunghezza una parola non è un pezzo di targa: è una parola. */
const MAX_IDENTIFIER_PIECE = 4;

/** Una parola lunga da sola, o 2-3 parole corte di fila (una targa spaziata) --- il limite evita di costruire identificativi dal nulla come "panda4". */
function identifiersIn(name: string): string[] {
  const tokens = normalize(name).split(" ").filter(Boolean);
  const found: string[] = [];

  for (let start = 0; start < tokens.length; start++) {
    for (let length = 1; length <= 3 && start + length <= tokens.length; length++) {
      const run = tokens.slice(start, start + length);
      if (length > 1 && run.some((token) => token.length > MAX_IDENTIFIER_PIECE)) continue;

      const joined = run.join("");
      if (joined.length >= MIN_IDENTIFIER_CHARS && /\d/.test(joined)) found.push(joined);
    }
  }

  return found;
}

/** Gli identificativi hanno la precedenza sui nomi: targa di un'auto batte nome generico di un'altra. */
export function suggestAssetFromText(
  text: string,
  assets: AssetListItem[],
): AssetListItem | null {
  if (!text.trim() || assets.length === 0) return null;
  const haystack = normalize(text);
  // Cercare in entrambe le forme (con/senza spazi) copre i due casi con una riga.
  const compact = haystack.replace(/\s+/g, "");

  for (const asset of assets) {
    if (identifiersIn(asset.name).some((id) => compact.includes(id))) return asset;
  }

  for (const asset of assets) {
    const name = normalize(asset.name);
    if (name.length < MIN_NAME_CHARS) continue;
    if (name.split(" ").length < MIN_NAME_WORDS) continue;
    if (haystack.includes(name)) return asset;
  }

  return null;
}
