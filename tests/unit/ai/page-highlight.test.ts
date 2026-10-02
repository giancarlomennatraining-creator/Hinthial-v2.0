import { describe, expect, it } from "vitest";
import { highlightRects, locateQuote, type PageTextItem } from "@/domain/ai/analysis/page-highlight";

const item = (str: string, x: number, y: number, width = str.length * 6, size = 12): PageTextItem => ({
  str,
  transform: [size, 0, 0, size, x, y],
  width,
  height: size,
});

// Viewport scala 2 di una pagina alta 800: y_canvas = (800 - y) * 2
const VIEWPORT = [2, 0, 0, -2, 0, 1600];

describe("locateQuote", () => {
  const items = [item("Valida", 60, 700), item("fino al", 100, 700), item("3 giugno 2027.", 150, 700)];

  it("trova la frase attraverso più elementi, senza badare a spazi e maiuscole", () => {
    expect(locateQuote(items, "valida fino al 3 giugno 2027.")).toEqual([
      { item: 0, start: 0, end: 6 },
      { item: 1, start: 0, end: 7 },
      { item: 2, start: 0, end: 14 },
    ]);
  });

  it("restituisce solo la parte di un elemento che fa parte della frase", () => {
    expect(locateQuote([item("Scade il 3 giugno 2027 salvo disdetta", 60, 700)], "3 giugno 2027")).toEqual([
      { item: 0, start: 9, end: 22 },
    ]);
  });

  it("null se la frase non c'è o è vuota", () => {
    expect(locateQuote(items, "Scade domani")).toBeNull();
    expect(locateQuote(items, "   ")).toBeNull();
    expect(locateQuote([], "Valida")).toBeNull();
  });
});

describe("highlightRects", () => {
  it("porta la frase in percentuale dell'immagine, sopra la riga di base", () => {
    const items = [item("Valida fino al", 60, 700, 100)];
    const spans = locateQuote(items, "Valida")!;
    const [rect] = highlightRects(items, spans, VIEWPORT, 1200, 1600);
    // x = 60*2 = 120 -> 10%; baseline = (800-700)*2 = 200, font 24 -> top 176 -> 11%
    expect(rect.left).toBeCloseTo(10);
    expect(rect.top).toBeCloseTo((176 / 1600) * 100);
    // "Valida" sono 6 caratteri su 14: larghezza elemento 100*2 = 200 -> 200*6/14
    expect(rect.width).toBeCloseTo(((200 * 6) / 14 / 1200) * 100);
    expect(rect.height).toBeCloseTo(((24 * 1.2) / 1600) * 100);
  });

  it("non evidenzia testo ruotato, che non si descrive con un rettangolo", () => {
    const rotated: PageTextItem = { str: "Valida", transform: [0, 12, -12, 0, 100, 100], width: 36, height: 12 };
    expect(highlightRects([rotated], [{ item: 0, start: 0, end: 6 }], VIEWPORT, 1200, 1600)).toEqual([]);
  });
});
