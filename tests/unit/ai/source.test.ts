import { describe, expect, it } from "vitest";
import { splitAroundQuote } from "@/domain/ai/analysis/source";

describe("splitAroundQuote", () => {
  it("divide il testo attorno alla citazione, senza badare a maiuscole", () => {
    expect(splitAroundQuote("Prima. Valida fino al 3 giugno 2027. Dopo.", "valida fino al 3 giugno 2027.")).toEqual({
      before: "Prima. ",
      match: "Valida fino al 3 giugno 2027.",
      after: " Dopo.",
    });
  });

  it("tollera gli a capo e gli spazi doppi nel testo", () => {
    const excerpt = splitAroundQuote("Valida\nfino  al\n3 giugno", "Valida fino al 3 giugno");
    expect(excerpt?.match).toBe("Valida\nfino  al\n3 giugno");
  });

  it("tratta i caratteri speciali come testo", () => {
    expect(splitAroundQuote("Importo (IVA incl.) € 1.234,56", "(IVA incl.) € 1.234,56")?.match).toBe(
      "(IVA incl.) € 1.234,56",
    );
    expect(splitAroundQuote("Importo xIVA", "(IVA")).toBeNull();
  });

  it("restituisce null se la citazione non c'è o è vuota", () => {
    expect(splitAroundQuote("Un altro testo", "Valida fino")).toBeNull();
    expect(splitAroundQuote("Un testo", "   ")).toBeNull();
  });
});
