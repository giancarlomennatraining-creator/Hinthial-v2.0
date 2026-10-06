import { describe, expect, it } from "vitest";
import { buildAssetProposal, buildNewAssetProposal, normalizeIdentifier, type LinkedDocumentFields } from "@/domain/assets/link-proposal";

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

describe("buildNewAssetProposal", () => {
  const newBase = {
    doc: { relatedAssetId: null, structuredFields: {} as Record<string, string> },
    readFields: [] as { key: string; value: string }[],
    assets: ASSETS,
    rejections: [],
  };

  it("da una polizza con oggetto assicurato e targa propone di creare il bene col modello e la targa", () => {
    const proposal = buildNewAssetProposal({
      ...newBase,
      readFields: [
        { key: "oggetto_assicurato", value: "Ford Focus 1.5 EcoBlue" },
        { key: "targa", value: "ey389ym" },
      ],
    });
    expect(proposal).toMatchObject({ kind: "asset", createAsset: true, value: "Ford Focus 1.5 EcoBlue (EY389YM)" });
  });

  it("con la sola targa propone un veicolo", () => {
    expect(buildNewAssetProposal({ ...newBase, readFields: [{ key: "targa", value: "EY389YM" }] })).toMatchObject({
      createAsset: true,
      value: "Veicolo EY389YM",
    });
  });

  it("con il solo oggetto assicurato (una polizza casa) usa quello", () => {
    expect(
      buildNewAssetProposal({ ...newBase, readFields: [{ key: "oggetto_assicurato", value: "Appartamento in Via Roma 12" }] }),
    ).toMatchObject({ createAsset: true, value: "Appartamento in Via Roma 12" });
  });

  it("con il solo codice di fornitura propone un'utenza", () => {
    expect(buildNewAssetProposal({ ...newBase, readFields: [{ key: "codice_fornitura", value: "IT001E99887766" }] })).toMatchObject({
      createAsset: true,
      value: "Utenza IT001E99887766",
    });
  });

  it("un oggetto assicurato lungo come una frase non è il nome di un bene", () => {
    const sentence = "Tutti i beni mobili e immobili di proprietà del contraente situati nel territorio dello Stato";
    expect(buildNewAssetProposal({ ...newBase, readFields: [{ key: "oggetto_assicurato", value: sentence }] })).toBeNull();
  });

  it("se un bene con lo stesso nome esiste già propone di collegarlo, non di crearne un doppione", () => {
    const proposal = buildNewAssetProposal({
      ...newBase,
      assets: [{ id: "a-focus", name: "veicolo ey 389 ym" }],
      readFields: [{ key: "targa", value: "EY389YM" }],
    });
    expect(proposal).toMatchObject({ kind: "asset", value: "a-focus" });
    expect(proposal?.createAsset).toBeUndefined();
  });

  it("non propone niente se il documento ha già un bene o se la proposta è stata rifiutata", () => {
    const read = [{ key: "targa", value: "EY389YM" }];
    expect(buildNewAssetProposal({ ...newBase, doc: { relatedAssetId: "a-casa", structuredFields: {} }, readFields: read })).toBeNull();
    expect(
      buildNewAssetProposal({ ...newBase, readFields: read, rejections: [{ id: "r", kind: "asset", value: "Veicolo EY389YM" }] }),
    ).toBeNull();
  });

  it("senza identificativi non propone niente", () => {
    expect(buildNewAssetProposal({ ...newBase, readFields: [{ key: "premio", value: "612,40" }] })).toBeNull();
  });
});
