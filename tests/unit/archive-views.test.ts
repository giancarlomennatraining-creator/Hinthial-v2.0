import { describe, expect, it } from "vitest";
import { categoryColor, dueIn, expiryInfo, matchesQuery, mixColor, relativeDay } from "@/domain/documents/archive-views";
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
    // Un colore che non è un esadecimale (una variabile CSS) lo mescola il browser.
    expect(mixColor("var(--brand)", "#ffffff", 0.88)).toBe("color-mix(in srgb, var(--brand) 12%, #ffffff)");
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

describe("dueIn", () => {
  it("dice quanto manca come a voce, con lo stesso livello di urgenza di expiryInfo", () => {
    expect(dueIn("2026-10-03", NOW)).toMatchObject({ level: "overdue", text: "scaduta da 3 giorni" });
    expect(dueIn("2026-10-05", NOW)).toMatchObject({ level: "overdue", text: "scaduta da 1 giorno" });
    expect(dueIn("2026-10-06", NOW)).toMatchObject({ level: "danger", text: "oggi" });
    expect(dueIn("2026-10-07", NOW)).toMatchObject({ level: "danger", text: "domani" });
    expect(dueIn("2026-10-20", NOW)).toMatchObject({ level: "danger", days: 14, text: "fra 14 giorni" });
    expect(dueIn("2026-10-25", NOW)).toMatchObject({ level: "warn", days: 19, text: "fra 19 giorni" });
    expect(dueIn("2026-11-26", NOW)).toMatchObject({ level: "warn", days: 51, text: "fra 51 giorni" });
    expect(dueIn("2027-03-15", NOW)).toMatchObject({ level: "soft", text: "fra 5 mesi" });
    expect(dueIn("2029-10-06", NOW)).toMatchObject({ level: "soft", text: "fra 3 anni" });
  });

  it("il livello coincide con quello di expiryInfo per la stessa data", () => {
    for (const iso of ["2026-10-05", "2026-10-06", "2026-10-15", "2026-11-26", "2027-03-15"]) {
      expect(dueIn(iso, NOW).level).toBe(expiryInfo(iso, NOW).level);
    }
  });
});

describe("ricerca", () => {
  const docs = [
    doc({ id: "a", filename: "Polizza RCA Ford Focus.pdf", categoryId: "c-ass", structuredFields: { targa: "EY389YM" }, analysisStatus: "completed" }),
    doc({ id: "b", filename: "Bolletta luce.pdf", categoryId: "c-casa", expiresAt: "2026-10-15" }),
    doc({ id: "c", filename: "Scansione.pdf", createdAt: "2026-06-01T10:00:00.000Z" }),
    doc({ id: "d", filename: "Scansione.pdf", createdAt: "2026-06-02T10:00:00.000Z" }),
  ];

  it("cerca in nome, targa e categoria, con tutte le parole", () => {
    expect(matchesQuery(docs[0], "ey389ym", CATEGORIES, [])).toBe(true);
    expect(matchesQuery(docs[0], "focus assicurazioni", CATEGORIES, [])).toBe(true);
    expect(matchesQuery(docs[1], "ford", CATEGORIES, [])).toBe(false);
    expect(matchesQuery(docs[1], "   ", CATEGORIES, [])).toBe(true);
  });
});

describe("date leggibili", () => {
  it("dice da quanto, poi la data", () => {
    expect(relativeDay("2026-10-06T08:00:00.000Z", NOW)).toBe("oggi");
    expect(relativeDay("2026-10-05T08:00:00.000Z", NOW)).toBe("ieri");
    expect(relativeDay("2026-10-01T08:00:00.000Z", NOW)).toBe("5 giorni fa");
    expect(relativeDay("2026-07-04T08:00:00.000Z", NOW)).toBe("4 lug");
  });
});
