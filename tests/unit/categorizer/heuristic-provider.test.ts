import { describe, expect, it } from "vitest";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import type { Category } from "@/domain/categories/types";

function cat(id: string, name: string, icon: string): Category {
  return { id, name, icon, aiExtractionEnabled: false, aiExtractionEnabledUntil: null };
}

const DEFAULT_CATEGORIES: Category[] = [
  cat("cat-personale", "Personale", "👤"),
  cat("cat-casa", "Casa", "🏠"),
  cat("cat-veicoli", "Veicoli", "🚗"),
  cat("cat-assicurazioni", "Assicurazioni", "🛡️"),
  cat("cat-contratti", "Contratti", "📄"),
  cat("cat-fiscale", "Fiscale", "💰"),
  cat("cat-salute", "Salute", "❤️"),
  cat("cat-finanze", "Finanze", "📊"),
  cat("cat-account", "Account", "🔑"),
  cat("cat-altro", "Altro", "📦"),
];

describe("heuristicCategorizer.suggestCategory", () => {
  it("matches a filename keyword to the right default category", () => {
    expect(heuristicCategorizer.suggestCategory("polizza-auto.pdf", DEFAULT_CATEGORIES)).toBe(
      "cat-assicurazioni",
    );
    expect(heuristicCategorizer.suggestCategory("libretto-circolazione.pdf", DEFAULT_CATEGORIES)).toBe(
      "cat-veicoli",
    );
    expect(heuristicCategorizer.suggestCategory("fattura-2026.pdf", DEFAULT_CATEGORIES)).toBe(
      "cat-fiscale",
    );
    expect(heuristicCategorizer.suggestCategory("estratto-conto-marzo.pdf", DEFAULT_CATEGORIES)).toBe(
      "cat-finanze",
    );
  });

  it("matches directly on a category's own name, covering custom categories", () => {
    const categories: Category[] = [cat("cat-hobby", "Hobby", "🎨")];
    expect(heuristicCategorizer.suggestCategory("hobby-modellismo.pdf", categories)).toBe("cat-hobby");
  });

  it("is accent- and case-insensitive", () => {
    expect(heuristicCategorizer.suggestCategory("Carta-d'Identità.pdf", DEFAULT_CATEGORIES)).toBe(
      "cat-personale",
    );
  });

  it("returns null when nothing matches", () => {
    expect(heuristicCategorizer.suggestCategory("appunti-vari.txt", DEFAULT_CATEGORIES)).toBeNull();
  });

  it("does not suggest a keyword's category when the user no longer has one by that name", () => {
    const categoriesWithoutInsurance = DEFAULT_CATEGORIES.filter((c) => c.name !== "Assicurazioni");
    expect(heuristicCategorizer.suggestCategory("polizza.pdf", categoriesWithoutInsurance)).toBeNull();
  });

  it("prefers a direct category-name match over the curated keyword map", () => {
    // "Contratti" matches directly; the filename also contains "affitto" (a Casa keyword) --- direct match wins.
    expect(
      heuristicCategorizer.suggestCategory("contratti-affitto.pdf", DEFAULT_CATEGORIES),
    ).toBe("cat-contratti");
  });
});
