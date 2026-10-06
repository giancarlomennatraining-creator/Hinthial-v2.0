import { describe, expect, it } from "vitest";
import { assetDeadlines } from "@/domain/assets/deadlines";

const DOCS = [
  { id: "d1", filename: "Polizza RCA.pdf", relatedAssetId: "a1", expiresAt: "2027-03-15" },
  { id: "d2", filename: "Verbale.pdf", relatedAssetId: "a1", expiresAt: "2026-11-30" },
  { id: "d3", filename: "Altro bene.pdf", relatedAssetId: "a2", expiresAt: "2026-12-01" },
  { id: "d4", filename: "Senza scadenza.pdf", relatedAssetId: "a1", expiresAt: null },
];

function reminder(over: Partial<Parameters<typeof assetDeadlines>[2][number]> & { id: string }) {
  return { title: "Scadenza", dueAt: "2027-01-01T09:00:00.000Z", completed: false, relatedDocumentId: null, relatedAssetId: null, ...over };
}

describe("assetDeadlines", () => {
  it("riunisce scadenze del bene, dei suoi documenti e date di scadenza dei documenti, in ordine di data", () => {
    const result = assetDeadlines("a1", DOCS, [
      reminder({ id: "r1", title: "Revisione", dueAt: "2027-02-01T09:00:00.000Z", relatedAssetId: "a1" }),
      reminder({ id: "r2", title: "Disdetta polizza", dueAt: "2027-02-14T09:00:00.000Z", relatedDocumentId: "d1" }),
      reminder({ id: "r3", title: "Di un altro bene", relatedAssetId: "a2" }),
    ]);
    expect(result.map((d) => d.title)).toEqual([
      "Verbale.pdf scade",
      "Revisione",
      "Disdetta polizza",
      "Polizza RCA.pdf scade",
    ]);
  });

  it("non mostra le scadenze già completate né quelle di documenti di altri beni", () => {
    const result = assetDeadlines("a2", DOCS, [reminder({ id: "r1", completed: true, relatedAssetId: "a2" })]);
    expect(result.map((d) => d.title)).toEqual(["Altro bene.pdf scade"]);
  });

  it("se un evento coincide con la scadenza del suo documento mostra solo l'evento", () => {
    const result = assetDeadlines("a1", [DOCS[1]], [
      reminder({ id: "r1", title: "Pagamento verbale", dueAt: "2026-11-30T09:00:00.000Z", relatedDocumentId: "d2" }),
    ]);
    expect(result.map((d) => d.title)).toEqual(["Pagamento verbale"]);
  });

  it("senza nulla restituisce un elenco vuoto", () => {
    expect(assetDeadlines("a9", DOCS, [])).toEqual([]);
  });
});
