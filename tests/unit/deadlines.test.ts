import { describe, expect, it } from "vitest";
import { mergeDeadlines, uncoveredExpiries } from "@/domain/deadlines";

const DOCS = [
  { id: "d1", filename: "Polizza casa.pdf", expiresAt: "2027-03-15" },
  { id: "d2", filename: "Passaporto.pdf", expiresAt: "2026-11-30" },
  { id: "d3", filename: "Senza data.pdf", expiresAt: null },
];

function reminder(over: { id: string } & Partial<Parameters<typeof mergeDeadlines>[1][number]>) {
  return { title: "Scadenza", dueAt: "2027-01-01T09:00:00.000Z", completed: false, relatedDocumentId: null, ...over };
}

describe("mergeDeadlines", () => {
  it("riunisce le scadenze create e le date dei documenti, dalla più vicina; i documenti senza data non contano", () => {
    const result = mergeDeadlines(DOCS, [reminder({ id: "r1", title: "Bollo auto", dueAt: "2027-01-10T09:00:00.000Z" })]);
    expect(result).toEqual([
      { kind: "document", id: "d2", title: "Passaporto.pdf scade", date: "2026-11-30" },
      { kind: "reminder", id: "r1", title: "Bollo auto", date: "2027-01-10T09:00:00.000Z" },
      { kind: "document", id: "d1", title: "Polizza casa.pdf scade", date: "2027-03-15" },
    ]);
  });

  it("le scadenze completate non compaiono", () => {
    expect(mergeDeadlines([], [reminder({ id: "r1", completed: true })])).toEqual([]);
  });

  it("se una scadenza è dello stesso giorno e dello stesso documento, mostra solo quella", () => {
    const result = mergeDeadlines(DOCS, [
      reminder({ id: "r1", title: "Rinnovo passaporto", dueAt: "2026-11-30T09:00:00.000Z", relatedDocumentId: "d2" }),
    ]);
    expect(result.map((d) => d.title)).toEqual(["Rinnovo passaporto", "Polizza casa.pdf scade"]);
  });

  it("una scadenza dello stesso documento ma di un altro giorno non nasconde la data del documento", () => {
    const result = mergeDeadlines([DOCS[1]], [
      reminder({ id: "r1", title: "Promemoria", dueAt: "2026-11-20T09:00:00.000Z", relatedDocumentId: "d2" }),
    ]);
    expect(result.map((d) => d.title)).toEqual(["Promemoria", "Passaporto.pdf scade"]);
  });

  it("anche una scadenza già completata copre la data del documento: è stata gestita", () => {
    const result = mergeDeadlines([DOCS[1]], [
      reminder({ id: "r1", completed: true, dueAt: "2026-11-30T09:00:00.000Z", relatedDocumentId: "d2" }),
    ]);
    expect(result).toEqual([]);
  });
});

describe("uncoveredExpiries", () => {
  it("toglie i documenti senza data e quelli già coperti da una scadenza dello stesso giorno", () => {
    const result = uncoveredExpiries(DOCS, [reminder({ id: "r1", dueAt: "2027-03-15T08:00:00.000Z", relatedDocumentId: "d1" })]);
    expect(result.map((d) => d.id)).toEqual(["d2"]);
  });
});
