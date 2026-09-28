import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeDocumentWithClaude, buildAIProposals, type AIExtractedFields } from "@/domain/ai/analyze-document";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ProposalRejection } from "@/domain/proposals/types";

const TEXT =
  "GENERALI ITALIA S.p.A.\nPolizza responsabilità civile\nNumero polizza: IT-4471-2027\nValida fino al 3 giugno 2027.";

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
    structuredFields: {},
    aiSynthesis: "",
    aiSynthesisGeneratedAt: null,
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

  it("manda testo, categorie e scope alla route, e ritorna i campi validati (incluso un campo generico e la sintesi)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027." }],
          issuer: [{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A." }],
          category: { id: "cat-assicurazioni", source: "Polizza responsabilità civile" },
          fields: [
            { key: "Numero Polizza", label: "Numero polizza", value: "IT-4471-2027", source: "Numero polizza: IT-4471-2027" },
          ],
          synthesis: "Polizza di responsabilità civile emessa da Generali Italia, valida fino al 3 giugno 2027.",
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
    // La chiave viene normalizzata --- "Numero Polizza" diventa "numero_polizza", per restare consistente sui documenti successivi.
    expect(fields.fields).toEqual([
      { key: "numero_polizza", label: "Numero polizza", value: "IT-4471-2027", source: "Numero polizza: IT-4471-2027" },
    ]);
    expect(fields.synthesis).toBe("Polizza di responsabilità civile emessa da Generali Italia, valida fino al 3 giugno 2027.");
  });

  it("scarta un campo generico la cui citazione non compare davvero nel testo --- niente proposte inventate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          result: {
            expiry: [],
            issuer: [],
            category: null,
            fields: [{ key: "targa", label: "Targa", value: "AB123CD", source: "non è nel documento" }],
            synthesis: null,
          },
        }),
      }),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.fields).toEqual([]);
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

  it("nessuna sintesi (null) resta null, non stringa vuota inventata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: { expiry: [], issuer: [], category: null, fields: [], synthesis: null } }),
      }),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.synthesis).toBeNull();
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
  const FIELDS: AIExtractedFields = {
    expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027." }],
    issuer: [{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A." }],
    category: { value: "cat-assicurazioni", source: "Polizza" },
    fields: [{ key: "numero_polizza", label: "Numero polizza", value: "IT-4471-2027", source: "Numero polizza: IT-4471-2027" }],
    synthesis: "Una sintesi qualunque.",
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

  it("propone un campo generico con la sua chiave e la sua etichetta", () => {
    const field = buildAIProposals(doc(), FIELDS, []).find((p) => p.kind === "field");
    expect(field).toMatchObject({ value: "IT-4471-2027", fieldKey: "numero_polizza", fieldLabel: "Numero polizza" });
  });

  it("non propone un campo generico già presente in structuredFields", () => {
    const proposals = buildAIProposals(doc({ structuredFields: { numero_polizza: "già impostato" } }), FIELDS, []);
    expect(proposals.some((p) => p.kind === "field")).toBe(false);
  });

  it("non ripropone un campo generico già rifiutato per la stessa chiave e lo stesso valore", () => {
    const rejections: ProposalRejection[] = [
      { id: "r1", kind: "field", fieldKey: "numero_polizza", value: "IT-4471-2027" },
    ];
    const proposals = buildAIProposals(doc(), FIELDS, rejections);
    expect(proposals.some((p) => p.kind === "field")).toBe(false);
  });

  it("un rifiuto su una chiave non blocca un'altra chiave con lo stesso valore", () => {
    const rejections: ProposalRejection[] = [
      { id: "r1", kind: "field", fieldKey: "altra_chiave", value: "IT-4471-2027" },
    ];
    const proposals = buildAIProposals(doc(), FIELDS, rejections);
    expect(proposals.some((p) => p.kind === "field")).toBe(true);
  });
});
