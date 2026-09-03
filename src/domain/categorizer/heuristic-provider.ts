import type { Category } from "@/domain/categories/types";
import type { Categorizer } from "@/domain/categorizer/types";

/**
 * Parole chiave associate al nome delle categorie seminate di default
 * (v. supabase/migrations/20260828020000_documents_vault.sql,
 * seed_default_categories) --- usate solo se l'utente ha ancora una
 * categoria con quel nome: se l'ha rinominata o cancellata, questa
 * corrispondenza semplicemente non scatta più.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Assicurazioni: ["assicurazion", "polizza"],
  Veicoli: ["veicol", "auto", "moto", "patente", "libretto", "tagliando", "revisione", "bollo"],
  Casa: ["affitto", "locazione", "mutuo", "condominio", "immobile"],
  Contratti: ["contratto"],
  Fiscale: ["fiscale", "fattura", "f24", "dichiarazione", "tasse", "irpef", "730"],
  Salute: ["referto", "cartella clinica", "ricetta", "esame", "vaccin"],
  Finanze: ["estratto conto", "bonifico", "banca", "conto corrente", "investiment"],
  Account: ["password", "credenzial"],
  Personale: ["carta d'identita", "carta identita", "passaporto", "codice fiscale", "certificato"],
};

/** ̀-ͯ: i segni diacritici combinanti prodotti da normalize("NFD") (es. "identità" -> "identità" -> "identita"). */
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(text: string): string {
  // Un nome file usa trattini/underscore/punti al posto degli spazi
  // ("estratto-conto-marzo.pdf") --- normalizzati a spazi così le
  // parole chiave multi-parola (es. "estratto conto") continuano a
  // corrispondere per substring invece di richiedere una parola sola.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[-_.]+/g, " ");
}

function suggestCategory(filename: string, categories: Category[]): string | null {
  const normalizedFilename = normalize(filename);

  // 1) corrispondenza diretta col nome di una categoria dell'utente ---
  // copre anche le categorie personalizzate, non solo quelle di default.
  for (const category of categories) {
    const name = normalize(category.name);
    if (name.length >= 3 && normalizedFilename.includes(name)) return category.id;
  }

  // 2) parole chiave curate, solo se l'utente ha ancora una categoria
  // con quel nome (v. sopra).
  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!keywords.some((keyword) => normalizedFilename.includes(keyword))) continue;
    const match = categories.find((c) => normalize(c.name) === normalize(categoryName));
    if (match) return match.id;
  }

  return null;
}

export const heuristicCategorizer: Categorizer = { suggestCategory };
