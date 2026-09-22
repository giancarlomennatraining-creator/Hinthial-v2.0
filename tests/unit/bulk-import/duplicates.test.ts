/**
 * FASE 25 --- il rilevamento duplicati durante un import massivo. Come
 * groupByIssuer, testato soprattutto sui casi in cui deve tacere: nomi
 * simili ma dimensioni diverse, o viceversa, non sono un duplicato.
 */
import { describe, expect, it } from "vitest";
import { detectDuplicates } from "@/domain/bulk-import/duplicates";
import type { DocumentListItem } from "@/domain/documents/types";

function file(name: string, sizeBytes: number): { file: File } {
  return { file: new File([new Uint8Array(sizeBytes)], name) };
}

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "doc.pdf",
    mimeType: "application/pdf",
    size: 100,
    categoryId: null,
    relatedAssetId: null,
    dossierIds: [],
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

describe("detectDuplicates", () => {
  it("flags a file matching an existing document by name and size", () => {
    const existing = [doc({ filename: "fattura.pdf", size: 200, createdAt: "2026-03-01T00:00:00Z" })];
    const result = detectDuplicates([file("fattura.pdf", 200)], existing);
    expect(result[0]).toEqual({ filename: "fattura.pdf", createdAt: "2026-03-01T00:00:00Z" });
  });

  it("is case-insensitive on the filename", () => {
    const existing = [doc({ filename: "Fattura.PDF", size: 200 })];
    const result = detectDuplicates([file("fattura.pdf", 200)], existing);
    expect(result[0]).not.toBeNull();
  });

  it("does not flag a same-name file with a different size", () => {
    const existing = [doc({ filename: "fattura.pdf", size: 200 })];
    const result = detectDuplicates([file("fattura.pdf", 999)], existing);
    expect(result[0]).toBeNull();
  });

  it("does not flag a same-size file with a different name", () => {
    const existing = [doc({ filename: "fattura.pdf", size: 200 })];
    const result = detectDuplicates([file("altro-file.pdf", 200)], existing);
    expect(result[0]).toBeNull();
  });

  it("flags two files in the same batch sharing name and size, but not the first occurrence", () => {
    const result = detectDuplicates([file("scan.pdf", 500), file("scan.pdf", 500)], []);
    expect(result[0]).toBeNull();
    expect(result[1]).toEqual({ filename: "scan.pdf", createdAt: "" });
  });

  it("returns nothing for an empty batch against an empty archive", () => {
    expect(detectDuplicates([], [])).toEqual([]);
  });

  it("prefers an existing-archive match over a same-batch match when both exist", () => {
    const existing = [doc({ filename: "scan.pdf", size: 500, createdAt: "2026-05-01T00:00:00Z" })];
    const result = detectDuplicates([file("scan.pdf", 500), file("scan.pdf", 500)], existing);
    expect(result[0]).toEqual({ filename: "scan.pdf", createdAt: "2026-05-01T00:00:00Z" });
    expect(result[1]).toEqual({ filename: "scan.pdf", createdAt: "2026-05-01T00:00:00Z" });
  });
});
