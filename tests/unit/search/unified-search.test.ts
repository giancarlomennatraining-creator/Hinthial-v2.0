import { describe, expect, it } from "vitest";
import { countByArea, searchEverything } from "@/domain/search/unified-search";
import type { AIContext } from "@/domain/ai/types";
import type { DocumentListItem } from "@/domain/documents/types";

function doc(overrides: Partial<DocumentListItem>): DocumentListItem {
  return {
    id: "doc",
    filename: "file.pdf",
    mimeType: "application/pdf",
    size: 1000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-01-01",
    storagePath: "",
    wrappedDocumentKey: "",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: "",
    extractedAt: null,
    hasThumbnail: false,
    aiExtractionExcluded: false,
    structuredFields: {},
    aiSynthesis: "",
    aiSynthesisGeneratedAt: null,
    contentAnalysis: null,
    analysisStatus: null,
    analysisUpdatedAt: null,
    issuer: "",
    deletedAt: null,
    purgeAt: null,
    dossierIds: [],
    ...overrides,
  };
}

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [
      { id: "cat-ass", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: false, aiExtractionEnabledUntil: null },
    ],
    assets: [{ id: "asset-auto", name: "Auto Panda", categoryId: null, createdAt: "2026-01-01" }],
    documents: [
      doc({ id: "d1", filename: "polizza-auto.pdf", categoryId: "cat-ass" }),
      doc({
        id: "d2",
        filename: "scan_0012.pdf",
        extractedText: "Referto di cardiologia\ncontrollo annuale presso l'ospedale",
      }),
      doc({ id: "d3", filename: "bolletta.pdf", notes: "Pagata in ritardo", tags: ["Utenze"] }),
    ],
    reminders: [
      {
        id: "r1",
        title: "Bollo Panda",
        dueAt: "2026-11-30T00:00:00.000Z",
        completed: false,
        relatedDocumentId: null,
        relatedDocumentFilename: null,
        relatedAssetId: null,
        relatedAssetName: null,
        createdAt: "2026-01-01",
      },
    ],
    friends: [],
    capsules: [],
    ...overrides,
  };
}

describe("searchEverything", () => {
  it("non restituisce nulla per una ricerca vuota", () => {
    expect(searchEverything("   ", buildContext())).toEqual([]);
  });

  it("trova per nome in tutte le aree e conta per area", () => {
    const results = searchEverything("panda", buildContext());
    expect(results.map((r) => `${r.kind}:${r.id}`)).toEqual(["asset:asset-auto", "reminder:r1"]);
    expect(countByArea(results)).toEqual({ document: 0, reminder: 1, asset: 1, friend: 0, capsule: 0 });
  });

  it("richiede tutte le parole, non una qualsiasi", () => {
    const results = searchEverything("polizza panda", buildContext());
    expect(results).toEqual([]);
    expect(searchEverything("polizza auto", buildContext()).map((r) => r.id)).toEqual(["d1"]);
  });

  it("ignora maiuscole e accenti", () => {
    const context = buildContext({
      friends: [
        {
          id: "f1",
          name: "Nicolò Rossi",
          email: "",
          firstName: "",
          lastName: "",
          avatarPath: null,
          avatarUrl: null,
          role: "Avvocato",
          status: "active",
          isFriend: false,
          isGuardian: false,
          linkedUserId: null,
          createdAt: "2026-01-01",
        } as AIContext["friends"][number],
      ],
    });
    expect(searchEverything("NICOLO", context).map((r) => r.id)).toEqual(["f1"]);
  });

  it("trova dentro il testo letto e mostra il frammento, anche se le parole stanno su righe diverse", () => {
    const [result] = searchEverything("cardiologia controllo", buildContext());
    expect(result.id).toBe("d2");
    expect(result.rank).toBe(2);
    expect(result.snippetOrigin).toBe("text");
    expect(result.snippet?.match.toLowerCase()).toBe("cardiologia");
  });

  it("trova nelle note e nelle etichette", () => {
    const results = searchEverything("ritardo", buildContext());
    expect(results[0].snippetOrigin).toBe("notes");
    const byTag = searchEverything("utenze", buildContext());
    expect(byTag[0].id).toBe("d3");
    expect(byTag[0].rank).toBe(1);
    expect(byTag[0].snippet).toBeNull();
  });

  it("mette prima chi ha le parole nel nome, poi etichette, poi contenuto", () => {
    const context = buildContext({
      documents: [
        doc({ id: "dentro", filename: "altro.pdf", extractedText: "contiene la parola ricevuta" }),
        doc({ id: "etichetta", filename: "x.pdf", tags: ["ricevuta"] }),
        doc({ id: "nome", filename: "ricevuta.pdf" }),
      ],
    });
    expect(searchEverything("ricevuta", context).map((r) => r.id)).toEqual(["nome", "etichetta", "dentro"]);
  });

  it("non mostra il frammento quando il nome basta già a spiegare il risultato", () => {
    const [result] = searchEverything("polizza", buildContext());
    expect(result.snippet).toBeNull();
    expect(result.detail).toBe("Assicurazioni");
  });

  it("porta alla scheda del documento", () => {
    const [result] = searchEverything("polizza", buildContext());
    expect(result.href).toBe("/archive/d1");
  });
});
