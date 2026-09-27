import type { Category } from "@/domain/categories/types";
import type { Categorizer } from "@/domain/categorizer/types";

/** Parole chiave delle categorie seminate di default --- usate solo se l'utente ne ha ancora una con quel nome. */
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
  // Trattini/underscore/punti normalizzati a spazi, così le parole chiave multi-parola ("estratto conto") corrispondono comunque.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[-_.]+/g, " ");
}

function suggestCategory(filename: string, categories: Category[]): string | null {
  const normalizedFilename = normalize(filename);

  // 1) corrispondenza diretta col nome di una categoria (anche personalizzata).
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

/**
 * Come suggestCategory, ma legge anche il testo (FASE 17) se il nome file tace. Guardando dentro si usano SOLO le
 * parole chiave curate, non il nome categoria: su tremila caratteri "Casa" scatterebbe su qualunque testo che la nomina.
 */
function suggestCategoryFromContent(
  filename: string,
  text: string,
  categories: Category[],
): string | null {
  const fromFilename = suggestCategory(filename, categories);
  if (fromFilename) return fromFilename;

  if (!text.trim()) return null;
  const normalizedText = normalize(text);

  for (const [categoryName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!keywords.some((keyword) => normalizedText.includes(keyword))) continue;
    const match = categories.find((c) => normalize(c.name) === normalize(categoryName));
    if (match) return match.id;
  }

  return null;
}

export const heuristicCategorizer: Categorizer = { suggestCategory, suggestCategoryFromContent };
