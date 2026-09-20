/**
 * FASE 20 --- la cronologia di un fascicolo e il suo totale.
 *
 * Il totale è il punto più delicato: deve restituire `null` (non "0")
 * quando nessun documento ha un importo riconosciuto --- un fascicolo
 * senza importi non è un fascicolo che è costato zero, e mostrare
 * "€0,00" sarebbe un dato falso con l'aria di saperlo (v.
 * structured-fields.ts per lo stesso principio applicato altrove). E
 * deve sommare in centesimi, non in virgola mobile, altrimenti un
 * arrotondamento sbaglierebbe il totale di un centesimo.
 */
import { describe, expect, it } from "vitest";
import { buildDossierTimeline, dossierTotalAmount } from "@/domain/dossiers/timeline";
import type { DocumentListItem } from "@/domain/documents/types";

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "documento.pdf",
    mimeType: "application/pdf",
    size: 1000,
    categoryId: null,
    relatedAssetId: null,
    dossierId: "dossier-1",
    createdAt: "2026-01-01T10:00:00Z",
    storagePath: "x",
    wrappedDocumentKey: "x",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: "",
    extractedAt: "2026-01-01T10:00:00Z",
    hasThumbnail: false,
    ...over,
  };
}

describe("la cronologia", () => {
  it("ordina per la data letta nel documento, non per quella di caricamento", () => {
    const timeline = buildDossierTimeline([
      doc({ id: "recente", createdAt: "2026-01-01T00:00:00Z", extractedText: "Emesso il 3 giugno 2027" }),
      doc({ id: "vecchio", createdAt: "2026-06-01T00:00:00Z", extractedText: "Emesso il 14 marzo 2026" }),
    ]);

    // "vecchio" è stato caricato DOPO ma il documento parla di una data
    // ANTERIORE: la cronologia deve seguire la storia, non l'upload.
    expect(timeline.map((entry) => entry.document.id)).toEqual(["vecchio", "recente"]);
  });

  it("usa la data di caricamento come ripiego quando non trova nulla nel testo", () => {
    const timeline = buildDossierTimeline([doc({ extractedText: "" })]);
    expect(timeline[0].date).toBe("2026-01-01T10:00:00Z");
    expect(timeline[0].dateIsFromDocument).toBe(false);
  });

  it("segnala quando la data viene davvero dal documento", () => {
    const timeline = buildDossierTimeline([doc({ extractedText: "Emesso il 14 marzo 2026" })]);
    expect(timeline[0].date).toBe("2026-03-14");
    expect(timeline[0].dateIsFromDocument).toBe(true);
  });

  it("un fascicolo senza documenti ha una cronologia vuota", () => {
    expect(buildDossierTimeline([])).toEqual([]);
  });
});

describe("il totale", () => {
  it("somma gli importi trovati in più documenti", () => {
    const total = dossierTotalAmount([
      doc({ id: "a", extractedText: "Totale € 100,00" }),
      doc({ id: "b", extractedText: "Totale € 22,50" }),
    ]);
    expect(total).toBe("122.50");
  });

  it("non arrotonda in virgola mobile su tre documenti che notoriamente ci cadono", () => {
    // 0.10 + 0.20 in virgola mobile darebbe 0.30000000000000004.
    const total = dossierTotalAmount([
      doc({ id: "a", extractedText: "Totale € 0,10" }),
      doc({ id: "b", extractedText: "Totale € 0,20" }),
    ]);
    expect(total).toBe("0.30");
  });

  it("torna null e non '0' quando nessun documento ha un importo", () => {
    // Un fascicolo senza importi non è un fascicolo costato zero.
    const total = dossierTotalAmount([doc({ extractedText: "Referto senza numeri" })]);
    expect(total).toBeNull();
  });

  it("torna null su un fascicolo senza documenti", () => {
    expect(dossierTotalAmount([])).toBeNull();
  });

  it("ignora i documenti senza importo, ma conta quelli che ce l'hanno", () => {
    const total = dossierTotalAmount([
      doc({ id: "a", extractedText: "Referto senza numeri" }),
      doc({ id: "b", extractedText: "Totale € 50,00" }),
    ]);
    expect(total).toBe("50.00");
  });
});
