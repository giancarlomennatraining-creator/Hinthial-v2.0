import { describe, expect, it } from "vitest";
import {
  buildCollections,
  categoryColor,
  categoryFacets,
  countPresets,
  duplicateIds,
  expiryInfo,
  formatDayMonth,
  groupByMonth,
  isReadByHinthia,
  kindFacets,
  layoutShelf,
  matchesQuery,
  mixColor,
  relativeDay,
  shelfLabel,
  spineHeight,
  upcomingExpiries,
  yearFacets,
} from "@/domain/documents/archive-views";
import type { Category } from "@/domain/categories/types";
import type { DocumentSummary } from "@/domain/documents/types";

const NOW = new Date(2026, 9, 6, 12, 0, 0); // 6 ottobre 2026

function doc(over: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    filename: `${over.id}.pdf`,
    mimeType: "application/pdf",
    size: 100_000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    storagePath: `p/${over.id}`,
    wrappedDocumentKey: "k",
    expiresAt: null,
    notes: "",
    tags: [],
    extractedAt: null,
    hasThumbnail: false,
    dossierIds: [],
    deletedAt: null,
    purgeAt: null,
    issuer: "",
    aiExtractionExcluded: false,
    structuredFields: {},
    analysisStatus: null,
    analysisUpdatedAt: null,
    ...over,
  } as DocumentSummary;
}

const CATEGORIES: Category[] = [
  { id: "c-ass", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
  { id: "c-casa", name: "Casa", icon: "🏠", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
];

describe("colori delle categorie", () => {
  it("le categorie note hanno il loro colore, anche con maiuscole e accenti diversi", () => {
    expect(categoryColor("Assicurazioni")).toBe("#2b4fc4");
    expect(categoryColor("  CASA ")).toBe("#0f8b8d");
    expect(categoryColor("Identità")).toBe(categoryColor("identita"));
  });

  it("una categoria nuova ha sempre lo stesso colore, e senza categoria è grigio", () => {
    expect(categoryColor("Animali")).toBe(categoryColor("Animali"));
    expect(categoryColor("Animali")).toMatch(/^#[0-9a-f]{6}$/);
    expect(categoryColor(null)).toBe("#9aa1bd");
  });

  it("mescolare con il bianco schiarisce, con il nero scurisce", () => {
    expect(mixColor("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixColor("#2b4fc4", "#2b4fc4", 0.7)).toBe("#2b4fc4");
  });
});

describe("expiryInfo", () => {
  it("senza scadenza non dice nulla", () => {
    expect(expiryInfo(null, NOW)).toEqual({ level: "none", days: null, text: "" });
  });

  it("classifica per urgenza e scrive il testo", () => {
    expect(expiryInfo("2026-10-05", NOW)).toMatchObject({ level: "overdue", text: "scaduto da 1 giorno" });
    expect(expiryInfo("2026-10-06", NOW)).toMatchObject({ level: "danger", text: "scade oggi" });
    expect(expiryInfo("2026-10-15", NOW)).toMatchObject({ level: "danger", days: 9, text: "scade tra 9 giorni" });
    expect(expiryInfo("2026-11-26", NOW)).toMatchObject({ level: "warn", days: 51, text: "scade tra 51 giorni" });
    expect(expiryInfo("2027-03-15", NOW)).toMatchObject({ level: "soft", text: "scade tra 5 mesi" });
    expect(expiryInfo("2029-10-06", NOW)).toMatchObject({ level: "soft", text: "scade tra 3 anni" });
  });

  it("una data senza orario è un giorno del calendario, non la mezzanotte UTC", () => {
    expect(expiryInfo("2026-10-07", NOW).days).toBe(1);
  });
});

describe("ricerca e conteggi", () => {
  const docs = [
    doc({ id: "a", filename: "Polizza RCA Ford Focus.pdf", categoryId: "c-ass", structuredFields: { targa: "EY389YM" }, analysisStatus: "completed" }),
    doc({ id: "b", filename: "Bolletta luce.pdf", categoryId: "c-casa", tags: ["urgente"], expiresAt: "2026-10-15" }),
    doc({ id: "c", filename: "Scansione.pdf", createdAt: "2026-06-01T10:00:00.000Z" }),
    doc({ id: "d", filename: "Scansione.pdf", createdAt: "2026-06-02T10:00:00.000Z" }),
  ];

  it("cerca in nome, targa, tag e categoria, con tutte le parole", () => {
    expect(matchesQuery(docs[0], "ey389ym", CATEGORIES, [])).toBe(true);
    expect(matchesQuery(docs[0], "focus assicurazioni", CATEGORIES, [])).toBe(true);
    expect(matchesQuery(docs[1], "urgente", CATEGORIES, [])).toBe(true);
    expect(matchesQuery(docs[1], "ford", CATEGORIES, [])).toBe(false);
    expect(matchesQuery(docs[1], "   ", CATEGORIES, [])).toBe(true);
  });

  it("riconosce i doppioni: stesso nome e stessa dimensione", () => {
    expect([...duplicateIds(docs)].sort()).toEqual(["c", "d"]);
    expect(duplicateIds([doc({ id: "x", size: 1 }), doc({ id: "y", size: 2, filename: "x.pdf" })]).size).toBe(0);
  });

  it("conta le viste: in scadenza, da leggere, senza categoria, recenti, doppioni", () => {
    expect(countPresets(docs, NOW)).toEqual({ total: 4, expiring: 1, unread: 3, uncategorized: 2, recent: 2, duplicates: 2 });
    expect(isReadByHinthia(docs[0])).toBe(true);
    expect(isReadByHinthia(docs[1])).toBe(false);
  });

  it("facette: categorie dalla più usata con 'Senza categoria' in fondo, tipi e anni", () => {
    expect(categoryFacets(docs, CATEGORIES)).toEqual([
      { key: "c-ass", label: "Assicurazioni", count: 1 },
      { key: "c-casa", label: "Casa", count: 1 },
      { key: "", label: "Senza categoria", count: 2 },
    ]);
    expect(kindFacets(docs)).toEqual([{ key: "document", kind: "document", label: "Documento", count: 4 }]);
    expect(yearFacets(docs)).toEqual([{ key: "2026", label: "2026", count: 4 }]);
  });
});

describe("linea del tempo", () => {
  const docs = [
    doc({ id: "1", createdAt: "2026-10-03T10:00:00.000Z" }),
    doc({ id: "2", createdAt: "2026-10-01T10:00:00.000Z" }),
    doc({ id: "3", createdAt: "2026-09-20T10:00:00.000Z" }),
    doc({ id: "4", createdAt: "2025-12-31T10:00:00.000Z" }),
  ];

  it("raggruppa per mese dal più recente, e dentro il mese dal più recente", () => {
    const groups = groupByMonth(docs);
    expect(groups.map((g) => [g.key, g.count, g.label])).toEqual([
      ["2026-10", 2, "Ottobre 2026"],
      ["2026-09", 1, "Settembre 2026"],
      ["2025-12", 1, "Dicembre 2025"],
    ]);
    expect(groups[0].docs.map((d) => d.id)).toEqual(["1", "2"]);
    expect(groups[0].short).toBe("Ott");
  });

  it("le scadenze in arrivo sono dalla più urgente, già scadute comprese", () => {
    const withExpiry = [
      doc({ id: "x", expiresAt: "2026-11-20" }),
      doc({ id: "y", expiresAt: "2026-10-09" }),
      doc({ id: "z", expiresAt: "2027-05-01" }),
      doc({ id: "w", expiresAt: "2026-10-01" }),
      doc({ id: "n" }),
    ];
    expect(upcomingExpiries(withExpiry, NOW).map((u) => u.doc.id)).toEqual(["w", "y", "x"]);
  });

  it("date leggibili", () => {
    expect(formatDayMonth("2026-10-06")).toBe("6 ott");
    expect(relativeDay("2026-10-06T08:00:00.000Z", NOW)).toBe("oggi");
    expect(relativeDay("2026-10-05T08:00:00.000Z", NOW)).toBe("ieri");
    expect(relativeDay("2026-10-01T08:00:00.000Z", NOW)).toBe("5 giorni fa");
    expect(relativeDay("2026-07-04T08:00:00.000Z", NOW)).toBe("4 lug");
  });
});

describe("collezioni", () => {
  it("una collezione per categoria, dalla più grande, con 'Senza categoria' e le scadenze che chiedono attenzione", () => {
    const docs = [
      doc({ id: "1", categoryId: "c-ass", createdAt: "2026-10-03T10:00:00.000Z", expiresAt: "2026-10-12" }),
      doc({ id: "2", categoryId: "c-ass", createdAt: "2026-09-03T10:00:00.000Z" }),
      doc({ id: "3", categoryId: "c-casa" }),
      doc({ id: "4", categoryId: null }),
      doc({ id: "5", categoryId: "c-eliminata" }),
    ];
    const collections = buildCollections(docs, CATEGORIES, NOW);
    expect(collections.map((c) => [c.name, c.count, c.soon])).toEqual([
      ["Assicurazioni", 2, 1],
      ["Casa", 1, 0],
      ["Senza categoria", 1, 0],
    ]);
    expect(collections[0].lastAdded).toBe("2026-10-03T10:00:00.000Z");
  });
});

describe("scaffale", () => {
  it("l'altezza del dorso cresce con la dimensione, tra 96 e 152", () => {
    expect(spineHeight(1)).toBe(96);
    expect(spineHeight(500 * 1024 * 1024)).toBe(152);
    expect(spineHeight(200 * 1024)).toBeGreaterThan(spineHeight(20 * 1024));
  });

  it("riempie i ripiani da 42 colonne, i più recenti per primi, senza superarli", () => {
    const docs = Array.from({ length: 200 }, (_, i) =>
      doc({ id: `d${i}`, size: (i % 10) * 500_000 + 10_000, createdAt: new Date(2026, 9, 6 - (i % 28), 10).toISOString() }),
    );
    const shelves = layoutShelf(docs);
    expect(shelves).toHaveLength(4);
    for (const shelf of shelves) {
      const used = shelf.spines.reduce((a, s) => a + s.span, 0);
      expect(used).toBeLessThanOrEqual(42);
      expect(used).toBeGreaterThanOrEqual(41);
    }
    const shown = shelves.flatMap((s) => s.spines).length;
    expect(shown).toBeLessThanOrEqual(168);
    expect(shelves[0].spines[0].doc.createdAt >= shelves[0].spines[1].doc.createdAt).toBe(true);
  });

  it("pochi documenti stanno su un solo ripiano e tutti stretti", () => {
    const shelves = layoutShelf([doc({ id: "a" }), doc({ id: "b" }), doc({ id: "c" })]);
    expect(shelves).toHaveLength(1);
    expect(shelves[0].spines.map((s) => s.span)).toEqual([1, 1, 1]);
  });

  it("l'etichetta del ripiano dice i mesi coperti", () => {
    expect(shelfLabel([doc({ id: "a", createdAt: "2026-09-10T10:00:00.000Z" }), doc({ id: "b", createdAt: "2026-10-02T10:00:00.000Z" })])).toBe("set–ott 2026");
    expect(shelfLabel([doc({ id: "a", createdAt: "2026-10-10T10:00:00.000Z" })])).toBe("ott 2026");
    expect(shelfLabel([doc({ id: "a", createdAt: "2025-12-10T10:00:00.000Z" }), doc({ id: "b", createdAt: "2026-02-02T10:00:00.000Z" })])).toBe("dic 2025–feb 2026");
    expect(layoutShelf([])).toEqual([]);
  });
});
