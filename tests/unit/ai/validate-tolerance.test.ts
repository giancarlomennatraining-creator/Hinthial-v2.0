import { describe, expect, it } from "vitest";
import { ANALYSIS_SCHEMAS } from "@/domain/ai/analysis/schemas";
import { normalizeDateValue, valueMatchesQuote, validateBlock } from "@/domain/ai/analysis/validate";
import type { RawBlockAnalysis } from "@/domain/ai/analysis/types";

describe("importi: l'ordine tra valuta e cifra non conta", () => {
  it("accetta '612,40 euro' per una citazione che dice 'euro 612,40'", () => {
    expect(valueMatchesQuote("612,40 euro", "Premio annuo lordo: euro 612,40", "amount")).toBe(true);
    expect(valueMatchesQuote("€ 1.234,56", "Totale 1.234,56 €", "amount")).toBe(true);
    expect(valueMatchesQuote("6.070.000,00 euro", "Massimale RCA: euro 6.070.000,00", "text")).toBe(true);
  });

  it("continua a rifiutare un importo diverso o assente", () => {
    expect(valueMatchesQuote("612,50 euro", "Premio annuo lordo: euro 612,40", "amount")).toBe(false);
    expect(valueMatchesQuote("990,00 euro", "Premio annuo lordo", "amount")).toBe(false);
  });

  it("non lascia passare una cifra troppo corta, che si troverebbe in qualunque frase", () => {
    expect(valueMatchesQuote("5 euro", "pagamento entro il 25 del mese", "amount")).toBe(false);
  });

  it("non cambia il confronto per i testi senza valuta", () => {
    expect(valueMatchesQuote("Generali Italia", "GENERALI ITALIA S.p.A.", "text")).toBe(true);
    expect(valueMatchesQuote("Allianz", "GENERALI ITALIA S.p.A.", "text")).toBe(false);
  });
});

describe("date con l'ora", () => {
  it("tiene solo il giorno", () => {
    expect(normalizeDateValue("2027-03-20 10:30")).toBe("2027-03-20");
    expect(normalizeDateValue("2027-01-12 ore 9:30")).toBe("2027-01-12");
    expect(normalizeDateValue("2027-03-20T10:30:00")).toBe("2027-03-20");
    expect(normalizeDateValue(" 2027-03-20 ")).toBe("2027-03-20");
  });

  it("non tocca ciò che non è una data ISO", () => {
    expect(normalizeDateValue("Giorno 5 di ogni mese")).toBe("Giorno 5 di ogni mese");
    expect(normalizeDateValue("20/03/2027")).toBe("20/03/2027");
  });

  const segments = [{ id: "p1", page: 1, text: "Prossimo controllo fissato per il 20/03/2027 alle ore 10:30." }];
  const raw: RawBlockAnalysis = {
    documentType: "referto",
    expiry: [],
    issuer: [],
    category: null,
    fields: [],
    events: [
      { title: "Controllo cardiologico", value: "2027-03-20 10:30", segmentId: "p1", quote: "Prossimo controllo fissato per il 20/03/2027 alle ore 10:30" },
      { title: "Giorno del mese", value: "Giorno 5 di ogni mese", segmentId: "p1", quote: "Prossimo controllo fissato" },
    ],
    synthesis: null,
  };

  it("un evento con l'ora si valida e si normalizza al giorno; un valore che non è una data si scarta", () => {
    const validated = validateBlock(raw, segments, [], ANALYSIS_SCHEMAS.referto);
    expect(validated.events).toHaveLength(1);
    expect(validated.events[0]).toMatchObject({ title: "Controllo cardiologico", value: "2027-03-20" });
  });

  it("anche una scadenza con l'ora si normalizza", () => {
    const validated = validateBlock(
      { ...raw, events: [], expiry: [{ value: "2027-03-20 10:30", segmentId: "p1", quote: "Prossimo controllo fissato per il 20/03/2027" }] },
      segments,
      [],
      ANALYSIS_SCHEMAS.referto,
    );
    expect(validated.expiry.map((e) => e.value)).toEqual(["2027-03-20"]);
  });
});
