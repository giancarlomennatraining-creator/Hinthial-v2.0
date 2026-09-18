import type { AssetListItem } from "@/domain/assets/types";

/**
 * FASE 19b --- a quale dei tuoi beni si riferisce questo documento.
 *
 * È il collegamento più affidabile che Hinthial possa proporre, e il
 * motivo è che i beni hanno spesso un **identificativo unico**: una
 * targa, un IBAN, un numero di polizza, un numero di contratto. Se il
 * bene si chiama "Fiat Panda AB123CD" e nel documento compare
 * `AB123CD`, quella non è una somiglianza --- è una certezza. Nessuna
 * euristica sulle parole chiave arriva a quel livello.
 *
 * La trappola sta nei beni che si chiamano "Casa", "Auto" o "Conto":
 * cercare "casa" dentro tremila caratteri lo aggancerebbe a qualunque
 * documento che nomina una casa. È lo stesso errore evitato per le
 * categorie (v. domain/categorizer/heuristic-provider.ts), e la
 * soluzione è la stessa: sui nomi generici si sta zitti.
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
    // Targhe e IBAN si scrivono con o senza spazi e punti: si tolgono i
    // separatori interni alle parole così "AB 123 CD" e "AB123CD"
    // diventano la stessa cosa.
    .replace(/[-_./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Oltre questa lunghezza una parola non è un pezzo di targa: è una parola. */
const MAX_IDENTIFIER_PIECE = 4;

/**
 * Le parti del nome di un bene che valgono come identificativo.
 *
 * Una parola sola quando è già lunga abbastanza ("4471120039",
 * "AB123CD"); oppure due o tre parole **corte** di seguito, che è la
 * forma di una targa scritta spaziata: "AB 123 CD". Il limite sulle
 * parole corte serve a non costruire identificativi dal nulla --- "Panda
 * 4" diventerebbe "panda4", che in un testo qualunque si trova.
 */
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

/**
 * Il bene a cui questo documento sembra riferirsi, o null.
 *
 * Gli identificativi hanno la precedenza sui nomi: se un documento cita
 * la targa di un'auto e il nome generico di un'altra, è della prima.
 */
export function suggestAssetFromText(
  text: string,
  assets: AssetListItem[],
): AssetListItem | null {
  if (!text.trim() || assets.length === 0) return null;
  const haystack = normalize(text);
  // Anche senza spazi: un identificativo si scrive "AB123CD" in un
  // documento e "AB 123 CD" nel nome del bene, o viceversa. Cercare in
  // entrambe le forme copre i due casi con una riga.
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
