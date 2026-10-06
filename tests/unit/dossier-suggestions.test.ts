import { describe, expect, it } from "vitest";
import {
  documentSuggestionKey,
  newSuggestionKey,
  suggestDocumentsForDossier,
  suggestNewDossiers,
} from "@/domain/dossiers/suggestions";
import type { DocumentSummary } from "@/domain/documents/types";

function doc(id: string, over: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id,
    filename: `${id}.pdf`,
    mimeType: "application/pdf",
    size: 1000,
    createdAt: "2026-09-01T10:00:00Z",
    categoryId: null,
    relatedAssetId: null,
    dossierIds: [],
    expiresAt: null,
    notes: "",
    tags: [],
    issuer: "",
    structuredFields: {},
    analysisStatus: "none",
    ...over,
  } as DocumentSummary;
}

const assets = [
  { id: "auto", name: "Ford Focus" },
  { id: "casa", name: "Casa di Roma" },
];
const none = new Set<string>();

describe("suggestDocumentsForDossier", () => {
  it("propone i documenti dello stesso bene che non sono nel fascicolo", () => {
    const documents = [
      doc("a", { relatedAssetId: "auto", dossierIds: ["F"] }),
      doc("b", { relatedAssetId: "auto", dossierIds: ["F"] }),
      doc("c", { relatedAssetId: "auto", createdAt: "2026-09-05T10:00:00Z" }),
      doc("d", { relatedAssetId: "auto", createdAt: "2026-09-09T10:00:00Z" }),
      doc("e", { relatedAssetId: "casa" }),
    ];
    const result = suggestDocumentsForDossier({ dossierId: "F", documents, assets, dismissed: none });
    expect(result.map((c) => c.documentId)).toEqual(["d", "c"]);
    expect(result[0].assetName).toBe("Ford Focus");
  });

  it("con un solo documento del bene nel fascicolo tace", () => {
    const documents = [doc("a", { relatedAssetId: "auto", dossierIds: ["F"] }), doc("c", { relatedAssetId: "auto" })];
    expect(suggestDocumentsForDossier({ dossierId: "F", documents, assets, dismissed: none })).toEqual([]);
  });

  it("con due beni a pari merito non sceglie", () => {
    const documents = [
      doc("a", { relatedAssetId: "auto", dossierIds: ["F"] }),
      doc("b", { relatedAssetId: "casa", dossierIds: ["F"] }),
      doc("c", { relatedAssetId: "auto" }),
    ];
    expect(suggestDocumentsForDossier({ dossierId: "F", documents, assets, dismissed: none })).toEqual([]);
  });

  it("salta quelli già rifiutati", () => {
    const documents = [
      doc("a", { relatedAssetId: "auto", dossierIds: ["F"] }),
      doc("b", { relatedAssetId: "auto", dossierIds: ["F"] }),
      doc("c", { relatedAssetId: "auto" }),
    ];
    const dismissed = new Set([documentSuggestionKey("F", "c")]);
    expect(suggestDocumentsForDossier({ dossierId: "F", documents, assets, dismissed })).toEqual([]);
  });
});

describe("suggestNewDossiers", () => {
  const three = [
    doc("a", { relatedAssetId: "auto" }),
    doc("b", { relatedAssetId: "auto" }),
    doc("c", { relatedAssetId: "auto" }),
  ];

  it("propone un fascicolo per tre documenti dello stesso bene senza fascicolo", () => {
    const result = suggestNewDossiers({ documents: three, dossiers: [], assets, dismissed: none });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ assetId: "auto", title: "Ford Focus" });
    expect(result[0].documentIds).toHaveLength(3);
  });

  it("non conta i documenti già in un fascicolo", () => {
    const documents = [...three.slice(0, 2), doc("c", { relatedAssetId: "auto", dossierIds: ["F"] })];
    expect(suggestNewDossiers({ documents, dossiers: [], assets, dismissed: none })).toEqual([]);
  });

  it("con due soli documenti tace", () => {
    expect(suggestNewDossiers({ documents: three.slice(0, 2), dossiers: [], assets, dismissed: none })).toEqual([]);
  });

  it("non crea un doppione di un fascicolo con lo stesso nome", () => {
    expect(
      suggestNewDossiers({ documents: three, dossiers: [{ title: "ford focus" }], assets, dismissed: none }),
    ).toEqual([]);
  });

  it("rispetta il rifiuto", () => {
    const dismissed = new Set([newSuggestionKey("auto")]);
    expect(suggestNewDossiers({ documents: three, dossiers: [], assets, dismissed })).toEqual([]);
  });
});
