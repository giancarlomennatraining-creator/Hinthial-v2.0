/**
 * FASE 21 --- totali di spesa per anno e categoria. Limite deliberato:
 * mostrare i numeri, mai interpretarli --- niente confronti, niente
 * soglie. Il punto da difendere con i test è che un gruppo senza importi
 * non compare affatto (mai uno "0" falso), e che la somma non sbaglia il
 * centesimo per un arrotondamento di virgola mobile.
 */
import { describe, expect, it } from "vitest";
import { totalsByYearAndCategory } from "@/domain/bulk-import/totals";
import type { DocumentListItem } from "@/domain/documents/types";

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "doc.pdf",
    mimeType: "application/pdf",
    size: 100,
    categoryId: null,
    relatedAssetId: null,
    dossierId: null,
    createdAt: "2026-01-01T00:00:00Z",
    storagePath: "x",
    wrappedDocumentKey: "x",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: "",
    extractedAt: "2026-01-01T00:00:00Z",
    hasThumbnail: false,
    ...over,
  };
}

describe("i totali", () => {
  it("somma per anno e categoria separatamente", () => {
    const totals = totalsByYearAndCategory([
      doc({ id: "a", categoryId: "salute", extractedText: "Totale € 100,00" }),
      doc({ id: "b", categoryId: "salute", extractedText: "Totale € 50,00" }),
      doc({ id: "c", categoryId: "casa", extractedText: "Totale € 200,00" }),
    ]);

    expect(totals).toContainEqual(
      expect.objectContaining({ year: 2026, categoryId: "salute", total: "150.00", documentCount: 2 }),
    );
    expect(totals).toContainEqual(
      expect.objectContaining({ year: 2026, categoryId: "casa", total: "200.00", documentCount: 1 }),
    );
  });

  it("usa l'anno letto nel documento, non quello di caricamento", () => {
    const totals = totalsByYearAndCategory([
      doc({ createdAt: "2026-01-01T00:00:00Z", extractedText: "Emesso il 14 marzo 2024. Totale € 10,00" }),
    ]);
    expect(totals[0].year).toBe(2024);
  });

  it("ricade sull'anno di caricamento quando il documento non ne dichiara uno", () => {
    const totals = totalsByYearAndCategory([
      doc({ createdAt: "2026-06-01T00:00:00Z", extractedText: "Totale € 10,00" }),
    ]);
    expect(totals[0].year).toBe(2026);
  });

  it("non arrotonda in virgola mobile", () => {
    const totals = totalsByYearAndCategory([
      doc({ id: "a", extractedText: "Totale € 0,10" }),
      doc({ id: "b", extractedText: "Totale € 0,20" }),
    ]);
    expect(totals[0].total).toBe("0.30");
  });

  it("un anno/categoria senza importi non compare affatto --- mai uno zero", () => {
    const totals = totalsByYearAndCategory([doc({ extractedText: "Referto senza numeri" })]);
    expect(totals).toEqual([]);
  });

  it("un archivio vuoto non produce niente", () => {
    expect(totalsByYearAndCategory([])).toEqual([]);
  });

  it("null è una categoria a sé, non ignorata", () => {
    const totals = totalsByYearAndCategory([
      doc({ categoryId: null, extractedText: "Totale € 10,00" }),
    ]);
    expect(totals[0].categoryId).toBeNull();
    expect(totals[0].total).toBe("10.00");
  });

  it("ordina per anno decrescente", () => {
    const totals = totalsByYearAndCategory([
      doc({ id: "a", createdAt: "2024-01-01T00:00:00Z", extractedText: "Totale € 10,00" }),
      doc({ id: "b", createdAt: "2026-01-01T00:00:00Z", extractedText: "Totale € 10,00" }),
    ]);
    expect(totals.map((t) => t.year)).toEqual([2026, 2024]);
  });
});
