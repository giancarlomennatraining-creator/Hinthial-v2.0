import { describe, expect, it } from "vitest";
import { matchExpected, type ExpectedItem } from "@/domain/dossiers/expected";
import type { DocumentSummary } from "@/domain/documents/types";

function doc(over: Partial<DocumentSummary> & { id: string; filename: string }): DocumentSummary {
  return {
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

const item = (id: string, label: string, done = false): ExpectedItem => ({ id, label, done });

describe("matchExpected", () => {
  it("abbina una voce a un documento che la nomina, anche al plurale", () => {
    const summary = matchExpected(
      [item("a", "Fattura"), item("b", "Referto")],
      [doc({ id: "d1", filename: "fatture-ortopedico.pdf" }), doc({ id: "d2", filename: "Referto_risonanza.pdf" })],
    );
    expect(summary.statuses.map((s) => s.documentId)).toEqual(["d1", "d2"]);
    expect(summary.done).toBe(2);
    expect(summary.total).toBe(2);
  });

  it("cerca anche in emittente, tag e campi letti, ignorando accenti e maiuscole", () => {
    const summary = matchExpected(
      [item("a", "Ricevuta"), item("b", "Certificato")],
      [
        doc({ id: "d1", filename: "scan0001.pdf", tags: ["RICEVUTA"] }),
        doc({ id: "d2", filename: "scan0002.pdf", structuredFields: { tipo: "Certificàto medico" } }),
      ],
    );
    expect(summary.statuses.map((s) => s.documentId)).toEqual(["d1", "d2"]);
  });

  it("vuole tutte le parole della voce", () => {
    const summary = matchExpected([item("a", "Fattura intervento")], [doc({ id: "d1", filename: "fattura-luce.pdf" })]);
    expect(summary.statuses[0].satisfied).toBe(false);
    expect(summary.done).toBe(0);
  });

  it("un documento soddisfa una sola voce", () => {
    const summary = matchExpected(
      [item("a", "Fattura"), item("b", "Fattura")],
      [doc({ id: "d1", filename: "fattura.pdf" })],
    );
    expect(summary.statuses.map((s) => s.documentId)).toEqual(["d1", null]);
    expect(summary.done).toBe(1);
  });

  it("una voce spuntata a mano è fatta anche senza documento", () => {
    const summary = matchExpected([item("a", "Ritirare l'originale", true)], []);
    expect(summary.statuses[0]).toMatchObject({ satisfied: true, documentId: null });
    expect(summary.done).toBe(1);
  });

  it("senza parole significative non si abbina da sola", () => {
    const summary = matchExpected([item("a", "di la")], [doc({ id: "d1", filename: "di-la.pdf" })]);
    expect(summary.statuses[0].satisfied).toBe(false);
  });

  it("senza voci il riepilogo è vuoto", () => {
    expect(matchExpected([], [doc({ id: "d1", filename: "x.pdf" })])).toEqual({ statuses: [], done: 0, total: 0 });
  });
});
