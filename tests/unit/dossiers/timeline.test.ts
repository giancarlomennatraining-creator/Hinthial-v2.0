/**
 * FASE 20 --- la cronologia di un fascicolo.
 */
import { describe, expect, it } from "vitest";
import { buildDossierTimeline } from "@/domain/dossiers/timeline";
import type { DocumentListItem } from "@/domain/documents/types";

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "documento.pdf",
    mimeType: "application/pdf",
    size: 1000,
    categoryId: null,
    relatedAssetId: null,
    dossierIds: ["dossier-1"],
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
    issuer: "",
    deletedAt: null,
    purgeAt: null,
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
