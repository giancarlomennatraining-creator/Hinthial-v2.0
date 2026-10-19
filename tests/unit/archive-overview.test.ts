import { describe, expect, it } from "vitest";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import {
  attentionFor,
  categoryTiles,
  filterByCategory,
  groupByMonth,
  NO_CATEGORY,
  parseArchiveView,
  sortDocuments,
} from "@/domain/documents/archive-overview";

function doc(over: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    filename: over.id,
    mimeType: "application/pdf",
    size: 1,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-10-10T10:00:00Z",
    storagePath: "p",
    wrappedDocumentKey: "k",
    expiresAt: null,
    notes: "",
    extractedAt: null,
    hasThumbnail: false,
    dossierIds: [],
    deletedAt: null,
    purgeAt: null,
    issuer: "",
    aiExtractionExcluded: false,
    structuredFields: {},
    aiSynthesisGeneratedAt: null,
    analysisStatus: null,
    analysisUpdatedAt: null,
    ...over,
  } as DocumentSummary;
}

const cat = (id: string, name: string): Category => ({ id, name, icon: "🏠" }) as Category;
const NOW = new Date(2026, 9, 18);

describe("parseArchiveView", () => {
  it("parte dalla panoramica senza una scelta valida", () => {
    expect(parseArchiveView(null)).toBe("panoramica");
    expect(parseArchiveView("boh")).toBe("panoramica");
    expect(parseArchiveView("elenco")).toBe("elenco");
    expect(parseArchiveView("schede")).toBe("schede");
  });
});

describe("filterByCategory", () => {
  const docs = [doc({ id: "a", categoryId: "c1" }), doc({ id: "b", categoryId: null }), doc({ id: "c", categoryId: "c2" })];
  it("vuoto = tutti; id = quella categoria; none = senza categoria", () => {
    expect(filterByCategory(docs, "")).toHaveLength(3);
    expect(filterByCategory(docs, "c1").map((d) => d.id)).toEqual(["a"]);
    expect(filterByCategory(docs, NO_CATEGORY).map((d) => d.id)).toEqual(["b"]);
  });
});

describe("sortDocuments", () => {
  const docs = [
    doc({ id: "b", filename: "bolletta", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2027-01-01" }),
    doc({ id: "a", filename: "Atto", createdAt: "2026-10-05T00:00:00Z" }),
    doc({ id: "c", filename: "contratto", createdAt: "2026-09-01T00:00:00Z", expiresAt: "2026-11-01" }),
  ];
  it("recenti: dal più nuovo", () => {
    expect(sortDocuments(docs, "recenti").map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
  it("scadenza: prima chi scade (la più vicina in testa), poi gli altri", () => {
    expect(sortDocuments(docs, "scadenza").map((d) => d.id)).toEqual(["c", "b", "a"]);
  });
  it("nome: alfabetico senza badare alle maiuscole", () => {
    expect(sortDocuments(docs, "nome").map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
  it("non tocca l'originale", () => {
    const before = docs.map((d) => d.id);
    sortDocuments(docs, "nome");
    expect(docs.map((d) => d.id)).toEqual(before);
  });
});

describe("groupByMonth", () => {
  it("raggruppa per mese di aggiunta mantenendo l'ordine", () => {
    const docs = [
      doc({ id: "1", createdAt: "2026-10-20T12:00:00Z" }),
      doc({ id: "2", createdAt: "2026-10-02T12:00:00Z" }),
      doc({ id: "3", createdAt: "2026-09-15T12:00:00Z" }),
    ];
    const groups = groupByMonth(docs);
    expect(groups.map((g) => [g.label, g.documents.length])).toEqual([
      ["ottobre 2026", 2],
      ["settembre 2026", 1],
    ]);
  });
});

describe("attentionFor", () => {
  it("elenca le scadenze urgenti, la più vicina per prima, e conta le altre", () => {
    const docs = [
      doc({ id: "lontana", expiresAt: "2028-01-01" }),
      doc({ id: "passata", expiresAt: "2026-10-08" }),
      doc({ id: "vicina", expiresAt: "2026-10-20" }),
      doc({ id: "tra-un-mese", expiresAt: "2026-11-15" }),
      doc({ id: "altra", expiresAt: "2026-11-20" }),
      doc({ id: "senza", categoryId: "c1" }),
    ];
    const result = attentionFor(docs, NOW, 3);
    expect(result.expiring.map((e) => e.doc.id)).toEqual(["passata", "vicina", "tra-un-mese"]);
    expect(result.expiringTotal).toBe(4);
    expect(result.uncategorized).toBe(5);
  });
});

describe("categoryTiles", () => {
  it("un riquadro per categoria con contenuti, le più piene per prime, e 'Senza categoria' in coda", () => {
    const categories = [cat("c1", "Casa"), cat("c2", "Salute"), cat("c3", "Vuota")];
    const docs = [
      doc({ id: "1", categoryId: "c1", createdAt: "2026-10-01T00:00:00Z" }),
      doc({ id: "2", categoryId: "c2", createdAt: "2026-10-02T00:00:00Z" }),
      doc({ id: "3", categoryId: "c2", createdAt: "2026-10-09T00:00:00Z" }),
      doc({ id: "4", categoryId: null }),
    ];
    const tiles = categoryTiles(docs, categories);
    expect(tiles.map((t) => [t.name, t.count])).toEqual([
      ["Salute", 2],
      ["Casa", 1],
      ["Senza categoria", 1],
    ]);
    expect(tiles[0].lastAt).toBe("2026-10-09T00:00:00Z");
    expect(tiles[2].id).toBeNull();
  });
});
