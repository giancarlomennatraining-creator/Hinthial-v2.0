import { describe, expect, it } from "vitest";
import {
  buildLivingTimeline,
  documentExpense,
  dossierDeadlines,
  dossierOverview,
  formatEuro,
  parseAmount,
} from "@/domain/dossiers/overview";
import type { DocumentSummary } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

const NOW = new Date(2026, 9, 7, 12, 0, 0); // 7 ottobre 2026

function doc(over: Partial<DocumentSummary> & { id: string }): DocumentSummary {
  return {
    filename: `${over.id}.pdf`,
    mimeType: "application/pdf",
    size: 100_000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    expiresAt: null,
    structuredFields: {},
    ...over,
  } as DocumentSummary;
}

function reminder(over: Partial<ReminderListItem> & { id: string }): ReminderListItem {
  return {
    title: "Scadenza",
    dueAt: "2026-10-20T09:00:00.000Z",
    completed: false,
    relatedDocumentId: null,
    relatedDocumentFilename: null,
    relatedAssetId: null,
    relatedAssetName: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

describe("parseAmount", () => {
  it("legge gli importi come si scrivono in Italia e come si scrivono altrove", () => {
    expect(parseAmount("EUR 612,40")).toBe(612.4);
    expect(parseAmount("€ 1.240,00")).toBe(1240);
    expect(parseAmount("612,40 €")).toBe(612.4);
    expect(parseAmount("1240.50")).toBe(1240.5);
    expect(parseAmount("1,240.50")).toBe(1240.5);
    expect(parseAmount("1.240")).toBe(1240);
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("9000")).toBe(9000);
  });

  it("ignora ciò che non è un importo, lo zero e i negativi", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n.d.")).toBeNull();
    expect(parseAmount("EUR 0,00")).toBeNull();
    expect(parseAmount("-45,00")).toBeNull();
    expect(parseAmount("12 mesi")).toBeNull();
  });
});

describe("spese", () => {
  it("conta solo gli importi che sono spese, con il campo più preciso", () => {
    expect(documentExpense(doc({ id: "a", structuredFields: { premio: "EUR 612,40", massimale: "EUR 6.070.000,00" } }))).toEqual({ amount: 612.4, label: "Premio" });
    expect(documentExpense(doc({ id: "b", structuredFields: { importo_totale: "84,20", premio: "10,00" } }))).toEqual({ amount: 84.2, label: "Importo" });
    expect(documentExpense(doc({ id: "c", structuredFields: { massimale: "EUR 6.070.000,00", saldo_finale: "3.412,10" } }))).toBeNull();
    expect(documentExpense(doc({ id: "d" }))).toBeNull();
  });

  it("scrive gli euro con il punto alle migliaia e senza decimali inutili", () => {
    expect(formatEuro(18420)).toBe("€ 18.420");
    expect(formatEuro(612.4)).toBe("€ 612,40");
    expect(formatEuro(1240)).toBe("€ 1.240");
    expect(formatEuro(0.5)).toBe("€ 0,50");
    expect(formatEuro(1234567)).toBe("€ 1.234.567");
  });
});

describe("scadenze del fascicolo", () => {
  const docs = [
    doc({ id: "d1", filename: "Polizza.pdf", expiresAt: "2026-11-30" }),
    doc({ id: "d2", filename: "Verbale.pdf", expiresAt: "2026-10-28" }),
    doc({ id: "d3", filename: "Senza scadenza.pdf" }),
  ];

  it("riunisce scadenze dei documenti e scadenze create, dalla più urgente", () => {
    const result = dossierDeadlines(docs, [reminder({ id: "r1", title: "Rogito", dueAt: "2026-10-19T09:00:00.000Z", relatedDocumentId: "d1" })], NOW);
    expect(result.map((d) => d.title)).toEqual(["Rogito", "Verbale.pdf scade", "Polizza.pdf scade"]);
    expect(result[0].info).toMatchObject({ level: "danger", days: 12 });
  });

  it("ignora le scadenze di altri documenti e quelle completate; un evento sul giorno di scadenza sostituisce il documento", () => {
    const result = dossierDeadlines(
      docs,
      [
        reminder({ id: "r1", relatedDocumentId: "altro" }),
        reminder({ id: "r2", completed: true, relatedDocumentId: "d1" }),
        reminder({ id: "r3", title: "Pagamento verbale", dueAt: "2026-10-28T09:00:00.000Z", relatedDocumentId: "d2" }),
      ],
      NOW,
    );
    expect(result.map((d) => d.title)).toEqual(["Pagamento verbale", "Polizza.pdf scade"]);
  });
});

describe("panoramica", () => {
  it("dà documenti, ultimo aggiornamento, spese, prossima scadenza e beni", () => {
    const overview = dossierOverview({
      documents: [
        doc({ id: "a", createdAt: "2026-09-10T10:00:00.000Z", structuredFields: { importo_totale: "€ 1.200,00" }, relatedAssetId: "casa" }),
        doc({ id: "b", createdAt: "2026-10-02T10:00:00.000Z", structuredFields: { premio: "EUR 300,00" }, relatedAssetId: "casa", expiresAt: "2026-10-20" }),
        doc({ id: "c", createdAt: "2026-09-20T10:00:00.000Z" }),
      ],
      reminders: [],
      assets: [{ id: "casa", name: "Casa di Via Roma" }],
      now: NOW,
    });
    expect(overview.documentCount).toBe(3);
    expect(overview.lastUpdate).toBe("2026-10-02T10:00:00.000Z");
    expect(overview.expenses).toMatchObject({ total: 1500 });
    expect(overview.expenses?.items.map((i) => i.filename)).toEqual(["a.pdf", "b.pdf"]);
    expect(overview.nextDeadline).toMatchObject({ title: "b.pdf scade", info: { days: 13 } });
    expect(overview.assets).toEqual([{ id: "casa", name: "Casa di Via Roma", count: 2 }]);
  });

  it("un fascicolo vuoto non inventa niente", () => {
    const overview = dossierOverview({ documents: [], reminders: [], assets: [], now: NOW });
    expect(overview).toMatchObject({ documentCount: 0, lastUpdate: null, expenses: null, nextDeadline: null, assets: [] });
  });
});

describe("cronologia viva", () => {
  it("mette insieme documenti, note e scadenze, dal più recente, con le spese", () => {
    const entries = buildLivingTimeline(
      [
        doc({ id: "a", filename: "Contratto.pdf", createdAt: "2026-06-14T10:00:00.000Z", structuredFields: { importo_totale: "9.000,00" } }),
        doc({ id: "n", filename: "Il notaio chiede l'APE", mimeType: NOTE_MIME_TYPE, createdAt: "2026-09-24T10:00:00.000Z" }),
      ],
      [
        reminder({ id: "r", title: "Rogito", dueAt: "2026-10-18T09:00:00.000Z", relatedDocumentId: "a" }),
        reminder({ id: "x", title: "Di un altro fascicolo", relatedDocumentId: "altro" }),
      ],
    );
    expect(entries.map((e) => [e.kind, e.title])).toEqual([
      ["event", "Rogito"],
      ["note", "Il notaio chiede l'APE"],
      ["document", "Contratto.pdf"],
    ]);
    expect(entries[2].expense).toBe(9000);
    expect(entries[1].detail).toBe("Nota");
  });
});
