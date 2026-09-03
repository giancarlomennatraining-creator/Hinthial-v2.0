import { describe, expect, it } from "vitest";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import type { Category } from "@/domain/categories/types";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-personale", name: "Personale", icon: "👤" },
  { id: "cat-casa", name: "Casa", icon: "🏠" },
  { id: "cat-veicoli", name: "Veicoli", icon: "🚗" },
  { id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️" },
  { id: "cat-contratti", name: "Contratti", icon: "📄" },
  { id: "cat-fiscale", name: "Fiscale", icon: "💰" },
  { id: "cat-salute", name: "Salute", icon: "❤️" },
  { id: "cat-finanze", name: "Finanze", icon: "📊" },
  { id: "cat-account", name: "Account", icon: "🔑" },
  { id: "cat-altro", name: "Altro", icon: "📦" },
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
    const categories: Category[] = [{ id: "cat-hobby", name: "Hobby", icon: "🎨" }];
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
