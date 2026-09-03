import { describe, expect, it } from "vitest";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import type { AIContext } from "@/domain/ai/types";

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [
      { id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️" },
      { id: "cat-casa", name: "Casa", icon: "🏠" },
    ],
    assets: [
      { id: "asset-auto", name: "Auto Panda", categoryId: "cat-assicurazioni", createdAt: "2026-01-01" },
      { id: "asset-casa", name: "Appartamento", categoryId: "cat-casa", createdAt: "2026-01-01" },
    ],
    documents: [
      {
        id: "doc-polizza",
        filename: "polizza-auto.pdf",
        mimeType: "application/pdf",
        size: 1000,
        categoryId: "cat-assicurazioni",
        relatedAssetId: "asset-auto",
        createdAt: "2026-01-01",
        storagePath: "",
        wrappedDocumentKey: "",
        expiresAt: null,
        notes: "",
        tags: [],
        transcript: "",
      },
      {
        id: "doc-affitto",
        filename: "contratto-affitto.pdf",
        mimeType: "application/pdf",
        size: 1000,
        categoryId: "cat-casa",
        relatedAssetId: "asset-casa",
        createdAt: "2026-01-01",
        storagePath: "",
        wrappedDocumentKey: "",
        expiresAt: null,
        notes: "",
        tags: [],
        transcript: "",
      },
    ],
    reminders: [
      {
        id: "rem-rinnovo",
        title: "Rinnovo assicurazione auto",
        dueAt: daysFromNow(-5),
        completed: false,
        relatedDocumentId: null,
        relatedDocumentFilename: null,
        relatedAssetId: "asset-auto",
        relatedAssetName: "Auto Panda",
        createdAt: "2026-01-01",
      },
    ],
    contacts: [],
    capsules: [],
    ...overrides,
  };
}

describe("mockAIProvider.search", () => {
  it("finds an asset by its own name", () => {
    const context = buildContext();
    const results = mockAIProvider.search("panda", context);
    expect(results.map((r) => r.id)).toContain("asset-auto");
  });

  it("does not resolve a category name to the items inside it (that's retrieve's job)", () => {
    const context = buildContext();
    const results = mockAIProvider.search("assicurazioni", context);
    expect(results).toEqual([]);
  });

  it("ignores tokens shorter than 3 characters", () => {
    const context = buildContext();
    expect(mockAIProvider.search("ok", context)).toEqual([]);
  });

  it("finds a document by a word written only in its transcript, not its filename", () => {
    const context = buildContext({
      documents: [
        {
          id: "doc-video",
          filename: "messaggio.webm",
          mimeType: "video/webm",
          size: 1000,
          categoryId: null,
          relatedAssetId: null,
          createdAt: "2026-01-01",
          storagePath: "",
          wrappedDocumentKey: "",
          expiresAt: null,
          notes: "",
          tags: [],
          transcript: "la combinazione della cassaforte è 12-34-56",
        },
      ],
    });
    const results = mockAIProvider.search("cassaforte", context);
    expect(results.map((r) => r.id)).toContain("doc-video");
  });

  it("finds a capsule by a word written only in one attachment's transcript", () => {
    const context = buildContext({
      capsules: [
        {
          id: "capsule-audio",
          title: "Per Maria",
          content: "un pensiero",
          attachments: [
            {
              id: "att-1",
              filename: "messaggio.webm",
              mimeType: "audio/webm",
              size: 1000,
              wrappedDocumentKey: "",
              transcript: "ti voglio bene, ricordati di innaffiare le piante",
            },
          ],
          linkedDocuments: [],
          relatedContacts: [],
          status: "draft",
          accessCondition: "manual",
          openAt: null,
          createdAt: "2026-01-01",
        },
      ],
    });
    const results = mockAIProvider.search("piante", context);
    expect(results.map((r) => r.id)).toContain("capsule-audio");
  });
});

describe("mockAIProvider.retrieve", () => {
  it("expands a category match to every asset/document in that category, plus their relations", () => {
    const context = buildContext();
    const results = mockAIProvider.retrieve("assicurazioni", context);
    const ids = results.map((r) => `${r.kind}:${r.id}`);

    expect(ids).toContain("asset:asset-auto");
    expect(ids).toContain("document:doc-polizza");
    expect(ids).toContain("reminder:rem-rinnovo");
    // La categoria "Casa" non è stata citata --- il suo asset resta fuori.
    expect(ids).not.toContain("asset:asset-casa");
  });

  it("does not duplicate a source reached through more than one relation", () => {
    const context = buildContext();
    const results = mockAIProvider.retrieve("panda", context);
    const documentMatches = results.filter((r) => r.kind === "document" && r.id === "doc-polizza");
    expect(documentMatches).toHaveLength(1);
  });

  it("expands a capsule match to its linked documents and recipients", () => {
    const context = buildContext({
      capsules: [
        {
          id: "capsule-1",
          title: "Per Maria",
          content: "un pensiero",
          attachments: [],
          linkedDocuments: [
            {
              id: "doc-polizza",
              filename: "polizza-auto.pdf",
              mimeType: "application/pdf",
              size: 1000,
              categoryId: "cat-assicurazioni",
              relatedAssetId: "asset-auto",
              createdAt: "2026-01-01",
              storagePath: "",
              wrappedDocumentKey: "",
              expiresAt: null,
              notes: "",
              tags: [],
              transcript: "",
            },
          ],
          relatedContacts: [
            { id: "contact-1", name: "Maria Rossi", email: "maria@esempio.it", role: "Coniuge", status: "active", createdAt: "2026-01-01" },
          ],
          status: "draft",
          accessCondition: "manual",
          openAt: null,
          createdAt: "2026-01-01",
        },
      ],
    });

    const results = mockAIProvider.retrieve("maria", context);
    const ids = results.map((r) => `${r.kind}:${r.id}`);
    expect(ids).toContain("capsule:capsule-1");
    expect(ids).toContain("contact:contact-1");
    expect(ids).toContain("document:doc-polizza");
  });

  it('stays filtered to the category actually named, e.g. "quali documenti riguardano la casa?"', () => {
    const context = buildContext();
    const results = mockAIProvider.retrieve("quali documenti riguardano la casa", context);
    const ids = results.map((r) => `${r.kind}:${r.id}`);

    expect(ids).toContain("document:doc-affitto");
    expect(ids).not.toContain("document:doc-polizza");
  });

  it('falls back to every item of a kind when nothing specific matches, e.g. "quanti contatti ho?"', () => {
    const context = buildContext({
      contacts: [
        { id: "contact-1", name: "Maria Rossi", email: "maria@esempio.it", role: "Coniuge", status: "active", createdAt: "2026-01-01" },
        { id: "contact-2", name: "Luca Bianchi", email: "luca@esempio.it", role: "Fratello", status: "active", createdAt: "2026-01-01" },
      ],
    });

    const results = mockAIProvider.retrieve("quanti contatti ho?", context);
    expect(results.map((r) => r.id).sort()).toEqual(["contact-1", "contact-2"]);
  });

  it("does not fall back to \"list everything of this kind\" when the rest of the question already narrowed the results", () => {
    const context = buildContext();
    // Contiene la parola "documenti" (che da sola farebbe scattare il
    // ripiego "elencali tutti"), ma anche "casa", che trova già un
    // risultato specifico --- deve prevalere quello specifico.
    const results = mockAIProvider.retrieve("quanti documenti riguardano la casa?", context);
    const ids = results.map((r) => `${r.kind}:${r.id}`);

    expect(ids).toContain("document:doc-affitto");
    expect(ids).not.toContain("document:doc-polizza");
  });
});

describe("mockAIProvider.answer", () => {
  it("groups the retrieved sources by kind in the response text", () => {
    const context = buildContext();
    const result = mockAIProvider.answer("assicurazioni", context);
    expect(result.text).toContain("Auto Panda");
    expect(result.text).toContain("polizza-auto.pdf");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("says plainly when nothing matches, instead of inventing an answer", () => {
    const context = buildContext();
    const result = mockAIProvider.answer("xyz-non-esistente", context);
    expect(result.text).toContain("Non ho trovato nulla");
    expect(result.sources).toEqual([]);
  });
});

describe("mockAIProvider.suggest", () => {
  it("flags overdue reminders", () => {
    const context = buildContext();
    const suggestions = mockAIProvider.suggest(context);
    const overdue = suggestions.find((s) => s.text.includes("scaduta"));
    expect(overdue).toBeDefined();
    expect(overdue?.sources.map((s) => s.id)).toContain("rem-rinnovo");
  });

  it("flags an asset with no linked documents", () => {
    const context = buildContext({
      assets: [
        { id: "asset-auto", name: "Auto Panda", categoryId: "cat-assicurazioni", createdAt: "2026-01-01" },
        { id: "asset-barca", name: "Barca", categoryId: null, createdAt: "2026-01-01" },
      ],
    });
    const suggestions = mockAIProvider.suggest(context);
    const noDocs = suggestions.find((s) => s.text.includes("Barca"));
    expect(noDocs).toBeDefined();
  });

  it("returns nothing when there's nothing to flag", () => {
    const context = buildContext({
      reminders: [],
      assets: [],
      documents: [],
    });
    expect(mockAIProvider.suggest(context)).toEqual([]);
  });
});
