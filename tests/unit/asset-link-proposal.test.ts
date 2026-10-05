import { describe, expect, it } from "vitest";
import { buildAssetProposal, normalizeIdentifier, type LinkedDocumentFields } from "@/domain/assets/link-proposal";

const ASSETS = [
  { id: "a-panda", name: "Fiat Panda" },
  { id: "a-casa", name: "Casa di Roma" },
];

const LINKED: LinkedDocumentFields[] = [
  { filename: "Polizza RCA 2026.pdf", assetId: "a-panda", fields: { targa: "AB123CD", numero_polizza: "RCA-998877" } },
  { filename: "Bolletta luce.pdf", assetId: "a-casa", fields: { codice_fornitura: "IT001E12345678" } },
];

const base = {
  doc: { relatedAssetId: null, structuredFields: {} as Record<string, string> },
  readFields: [] as { key: string; value: string }[],
  linked: LINKED,
  assets: ASSETS,
  rejections: [],
};

describe("normalizeIdentifier", () => {
  it("ignora maiuscole, spazi, trattini e accenti", () => {
    expect(normalizeIdentifier("ab 123-cd")).toBe("AB123CD");
    expect(normalizeIdentifier("rca/998 877")).toBe("RCA998877");
  });
});

describe("buildAssetProposal", () => {
  it("propone il bene che ha già un documento con la stessa targa, anche scritta diversamente", () => {
    const proposal = buildAssetProposal({ ...base, readFields: [{ key: "targa", value: "ab 123 cd" }] });
    expect(proposal).toMatchObject({ kind: "asset", value: "a-panda" });
    expect(proposal?.source).toContain("Stessa targa");
    expect(proposal?.source).toContain("Polizza RCA 2026.pdf");
    expect(proposal?.source).toContain("Fiat Panda");
  });

  it("usa anche i campi già confermati nella Scheda", () => {
    const proposal = buildAssetProposal({ ...base, doc: { relatedAssetId: null, structuredFields: { numero_polizza: "RCA 998877" } } });
    expect(proposal).toMatchObject({ value: "a-panda" });
  });

  it("non propone niente se il documento ha già un bene", () => {
    expect(
      buildAssetProposal({ ...base, doc: { relatedAssetId: "a-casa", structuredFields: {} }, readFields: [{ key: "targa", value: "AB123CD" }] }),
    ).toBeNull();
  });

  it("un numero di fattura o di verbale non collega mai, anche se uguale", () => {
    const linked = [{ filename: "F1", assetId: "a-casa", fields: { numero_fattura: "2026/0042" } }];
    expect(buildAssetProposal({ ...base, linked, readFields: [{ key: "numero_fattura", value: "2026/0042" }] })).toBeNull();
  });

  it("confronta solo la stessa chiave: una targa non è un numero di polizza", () => {
    expect(buildAssetProposal({ ...base, readFields: [{ key: "numero_polizza", value: "AB123CD" }] })).toBeNull();
  });

  it("tace se lo stesso identificativo porta a due beni diversi", () => {
    const linked = [...LINKED, { filename: "Bollo.pdf", assetId: "a-casa", fields: { targa: "AB123CD" } }];
    expect(buildAssetProposal({ ...base, linked, readFields: [{ key: "targa", value: "AB123CD" }] })).toBeNull();
  });

  it("due identificativi che portano allo stesso bene danno una sola proposta", () => {
    const proposal = buildAssetProposal({
      ...base,
      readFields: [
        { key: "targa", value: "AB123CD" },
        { key: "numero_polizza", value: "RCA-998877" },
      ],
    });
    expect(proposal).toMatchObject({ value: "a-panda" });
  });

  it("ignora gli identificativi troppo corti", () => {
    const linked = [{ filename: "X", assetId: "a-panda", fields: { targa: "A1" } }];
    expect(buildAssetProposal({ ...base, linked, readFields: [{ key: "targa", value: "A1" }] })).toBeNull();
  });

  it("non ripropone un bene già rifiutato", () => {
    const rejections = [{ id: "r1", kind: "asset" as const, value: "a-panda" }];
    expect(buildAssetProposal({ ...base, rejections, readFields: [{ key: "targa", value: "AB123CD" }] })).toBeNull();
  });

  it("non propone un bene che non esiste più", () => {
    expect(buildAssetProposal({ ...base, assets: [], readFields: [{ key: "targa", value: "AB123CD" }] })).toBeNull();
  });

  it("senza documenti collegati non propone niente", () => {
    expect(buildAssetProposal({ ...base, linked: [], readFields: [{ key: "targa", value: "AB123CD" }] })).toBeNull();
  });
});
