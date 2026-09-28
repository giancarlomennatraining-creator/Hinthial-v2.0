import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeDocumentWithClaude, buildAIProposals } from "@/domain/ai/analyze-document";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ProposalRejection } from "@/domain/proposals/types";

const TEXT = "GENERALI ITALIA S.p.A.\nPolizza responsabilità civile\nValida fino al 3 giugno 2027.";

const CATEGORIES: Category[] = [
  { id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: true, aiExtractionEnabledUntil: null },
];

function doc(over: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    filename: "scan_0012.pdf",
    mimeType: "application/pdf",
    size: 1000,
    categoryId: null,
    relatedAssetId: null,
    createdAt: "2026-09-18T10:00:00Z",
    storagePath: "x",
    wrappedDocumentKey: "x",
    expiresAt: null,
    notes: "",
    tags: [],
    transcript: "",
    extractedText: TEXT,
    extractedAt: "2026-09-18T10:00:00Z",
    hasThumbnail: false,
    aiExtractionExcluded: false,
    deletedAt: null,
    purgeAt: null,
    dossierIds: [],
    issuer: "",
    ...over,
  };
}

describe("analyzeDocumentWithClaude", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda testo, categorie e scope alla route, e ritorna i campi validati", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027." }],
          issuer: [{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A." }],
          category: { id: "cat-assicurazioni", source: "Polizza responsabilità civile" },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/ai/analyze");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ documentId: "doc-1", scope: "category" });
    expect(body.categories).toEqual([{ id: "cat-assicurazioni", name: "Assicurazioni" }]);

    expect(fields.expiry).toEqual([{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027." }]);
    expect(fields.issuer).toEqual([{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A." }]);
    expect(fields.category).toEqual({ value: "cat-assicurazioni", source: "Polizza responsabilità civile" });
  });

  it("scarta un campo la cui citazione non compare davvero nel testo --- niente proposte inventate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            expiry: [{ value: "2099-01-01", source: "questa frase non esiste nel documento" }],
            issuer: [],
            category: null,
          },
        }),
      }),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.expiry).toEqual([]);
  });

  it("scarta una categoria proposta che non è tra quelle passate, anche con una citazione valida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            expiry: [],
            issuer: [],
            category: { id: "cat-inventata", source: "Polizza responsabilità civile" },
          },
        }),
      }),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.category).toBeNull();
  });

  it("propaga il messaggio di errore del server (consenso non attivo, categoria non abilitata, ...)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Questa categoria non è abilitata all'estrazione AI." }),
      }),
    );

    await expect(analyzeDocumentWithClaude(doc(), CATEGORIES, "category")).rejects.toThrow(
      "Questa categoria non è abilitata all'estrazione AI.",
    );
  });
});

describe("buildAIProposals", () => {
  const FIELDS = {
    expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027." }],
    issuer: [{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A." }],
    category: { value: "cat-assicurazioni", source: "Polizza" },
  };

  it("marca ogni proposta come aiGenerated", () => {
    const proposals = buildAIProposals(doc(), FIELDS, []);
    expect(proposals.length).toBeGreaterThan(0);
    for (const p of proposals) expect(p.aiGenerated).toBe(true);
  });

  it("non propone su un campo già compilato, come le proposte locali", () => {
    const proposals = buildAIProposals(doc({ expiresAt: "2030-01-01" }), FIELDS, []);
    expect(proposals.some((p) => p.kind === "expiry")).toBe(false);
  });

  it("non propone una categoria se il documento ne ha già una", () => {
    const proposals = buildAIProposals(doc({ categoryId: "cat-casa" }), FIELDS, []);
    expect(proposals.some((p) => p.kind === "category")).toBe(false);
  });

  it("non ripropone ciò che è già stato rifiutato", () => {
    const rejections: ProposalRejection[] = [{ id: "r1", kind: "expiry", value: "2027-06-03" }];
    const proposals = buildAIProposals(doc(), FIELDS, rejections);
    expect(proposals.some((p) => p.kind === "expiry")).toBe(false);
  });
});
