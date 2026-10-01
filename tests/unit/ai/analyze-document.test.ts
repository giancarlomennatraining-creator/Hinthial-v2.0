import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analysisConfirmMessage,
  analyzeDocumentWithClaude,
  buildAIProposals,
  MAX_REQUESTS_PER_SESSION,
  planAnalysis,
  resetAnalysisSession,
  type AIExtractedFields,
} from "@/domain/ai/analyze-document";
import { MAX_BLOCK_CHARS } from "@/domain/ai/analysis/blocks";
import type { Category } from "@/domain/categories/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ContentSegment } from "@/domain/extraction/types";
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

/** Una risposta del server per un blocco, nella forma dell'output strutturato. */
function blockReply(result: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      result: { documentType: "polizza", expiry: [], issuer: [], category: null, fields: [], synthesis: null, ...result },
    }),
  };
}

function bodyOf(fetchSpy: ReturnType<typeof vi.fn>, call = 0) {
  return JSON.parse(fetchSpy.mock.calls[call][1].body);
}

describe("analyzeDocumentWithClaude", () => {
  beforeEach(() => {
    resetAnalysisSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda il blocco, le categorie e lo scope alla route, e ritorna i campi validati con la loro provenienza", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      blockReply({
        expiry: [{ value: "2027-06-03", segmentId: "s1", quote: "Valida fino al 3 giugno 2027." }],
        issuer: [{ value: "GENERALI ITALIA S.p.A.", segmentId: "s1", quote: "GENERALI ITALIA S.p.A." }],
        category: { id: "cat-assicurazioni", segmentId: "s1", quote: "Polizza responsabilità civile" },
        fields: [
          { key: "Numero Polizza", label: "Numero polizza", value: "IT-4471-2027", segmentId: "s1", quote: "Numero polizza: IT-4471-2027" },
        ],
        synthesis: "Polizza di responsabilità civile emessa da Generali Italia, valida fino al 3 giugno 2027.",
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/ai/analyze");
    const body = bodyOf(fetchSpy);
    expect(body).toMatchObject({ mode: "block", documentId: "doc-1", scope: "category", documentType: null });
    expect(body.categories).toEqual([{ id: "cat-assicurazioni", name: "Assicurazioni" }]);
    expect(body.block.text).toContain("[[s1]]");
    expect(body.block.text).toContain("Numero polizza: IT-4471-2027");

    const prov = { segmentId: "s1", page: null };
    expect(fields.expiry).toEqual([{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027.", provenance: prov }]);
    expect(fields.issuer).toEqual([{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A.", provenance: prov }]);
    expect(fields.category).toEqual({ value: "cat-assicurazioni", source: "Polizza responsabilità civile", provenance: prov });
    // La chiave viene normalizzata --- "Numero Polizza" diventa "numero_polizza", per restare consistente sui documenti successivi.
    expect(fields.fields).toEqual([
      { key: "numero_polizza", label: "Numero polizza", value: "IT-4471-2027", source: "Numero polizza: IT-4471-2027", provenance: prov },
    ]);
    expect(fields.synthesis).toBe("Polizza di responsabilità civile emessa da Generali Italia, valida fino al 3 giugno 2027.");
    expect(fields.documentType).toBe("polizza");
    expect(fields.coverage).toEqual({ blocksAnalyzed: 1, blocksTotal: 1, truncated: false });
  });

  it("con i segmenti per pagina la provenienza è la pagina", async () => {
    const segments: ContentSegment[] = [
      { id: "p1", kind: "page", index: 1, text: "GENERALI ITALIA S.p.A.\nPolizza responsabilità civile" },
      { id: "p2", kind: "page", index: 2, text: "Numero polizza: IT-4471-2027\nValida fino al 3 giugno 2027." },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({ expiry: [{ value: "2027-06-03", segmentId: "p2", quote: "Valida fino al 3 giugno 2027." }] }),
      ),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category", { segments });
    expect(fields.expiry[0].provenance).toEqual({ segmentId: "p2", page: 2 });
  });

  it("scarta una citazione che esiste nel documento ma non nel segmento indicato", async () => {
    const segments: ContentSegment[] = [
      { id: "p1", kind: "page", index: 1, text: "GENERALI ITALIA S.p.A." },
      { id: "p2", kind: "page", index: 2, text: "Valida fino al 3 giugno 2027." },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({ expiry: [{ value: "2027-06-03", segmentId: "p1", quote: "Valida fino al 3 giugno 2027." }] }),
      ),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category", { segments });
    expect(fields.expiry).toEqual([]);
  });

  it("scarta un campo la cui citazione non compare nel testo --- niente proposte inventate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({
          expiry: [{ value: "2099-01-01", segmentId: "s1", quote: "questa frase non esiste nel documento" }],
          fields: [{ key: "targa", label: "Targa", value: "AB123CD", segmentId: "s1", quote: "non è nel documento" }],
        }),
      ),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.expiry).toEqual([]);
    expect(fields.fields).toEqual([]);
  });

  it("scarta una data la cui citazione è vera ma dice un'altra data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({ expiry: [{ value: "2030-01-01", segmentId: "s1", quote: "Valida fino al 3 giugno 2027." }] }),
      ),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.expiry).toEqual([]);
  });

  it("scarta una categoria che non è tra quelle passate, anche con una citazione valida", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({ category: { id: "cat-inventata", segmentId: "s1", quote: "Polizza responsabilità civile" } }),
      ),
    );

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.category).toBeNull();
  });

  it("nessuna sintesi (null) resta null, non stringa vuota inventata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(blockReply({})));

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.synthesis).toBeNull();
  });

  it("un tipo fuori dal registro ricade su generico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(blockReply({ documentType: "ricetta_della_nonna" })));

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "category");
    expect(fields.documentType).toBe("generico");
  });

  it("un output che non ha la forma attesa non viene accettato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: { expiry: "domani" } }) }));

    await expect(analyzeDocumentWithClaude(doc(), CATEGORIES, "category")).rejects.toThrow("Risposta di Hinthia non valida.");
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

  it("un documento senza testo non parte nemmeno", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(analyzeDocumentWithClaude(doc({ extractedText: "  " }), CATEGORIES, "category")).rejects.toThrow(
      "non ha testo",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("analisi a più blocchi", () => {
  const LONG_PAGE = "Clausola di prova. ".repeat(500); // ~9.500 caratteri: due pagine non stanno in un blocco.
  const SEGMENTS: ContentSegment[] = [
    { id: "p1", kind: "page", index: 1, text: `Numero polizza: IT-4471-2027\n${LONG_PAGE}` },
    { id: "p2", kind: "page", index: 2, text: `${LONG_PAGE}\nValida fino al 3 giugno 2027.` },
  ];

  beforeEach(() => {
    resetAnalysisSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("legge a blocchi in ordine, riusa il tipo scelto al primo e fonde le letture e le sintesi", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(
        blockReply({
          documentType: "polizza",
          fields: [
            { key: "numero_polizza", label: "Numero polizza", value: "IT-4471-2027", segmentId: "p1", quote: "Numero polizza: IT-4471-2027" },
          ],
          synthesis: "Prima parte.",
        }),
      )
      .mockResolvedValueOnce(
        blockReply({
          documentType: null,
          expiry: [{ value: "2027-06-03", segmentId: "p2", quote: "Valida fino al 3 giugno 2027." }],
          synthesis: "Seconda parte.",
        }),
      )
      .mockResolvedValueOnce({ ok: true, json: async () => ({ synthesis: "Una polizza valida fino a giugno 2027." }) });
    vi.stubGlobal("fetch", fetchSpy);

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "once", { segments: SEGMENTS });

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(bodyOf(fetchSpy, 0).documentType).toBeNull();
    expect(bodyOf(fetchSpy, 1).documentType).toBe("polizza");
    expect(bodyOf(fetchSpy, 2)).toMatchObject({ mode: "merge", partials: ["Prima parte.", "Seconda parte."] });

    expect(fields.fields[0].provenance).toEqual({ segmentId: "p1", page: 1 });
    expect(fields.expiry[0].provenance).toEqual({ segmentId: "p2", page: 2 });
    expect(fields.synthesis).toBe("Una polizza valida fino a giugno 2027.");
    expect(fields.coverage).toEqual({ blocksAnalyzed: 2, blocksTotal: 2, truncated: false });
  });

  it("se la fusione delle sintesi fallisce, le letture con citazione restano e le sintesi parziali bastano", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(blockReply({ synthesis: "Prima parte." }))
      .mockResolvedValueOnce(blockReply({ documentType: null, synthesis: "Seconda parte." }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "boom" }) });
    vi.stubGlobal("fetch", fetchSpy);

    const fields = await analyzeDocumentWithClaude(doc(), CATEGORIES, "once", { segments: SEGMENTS });
    expect(fields.synthesis).toBe("Prima parte. Seconda parte.");
  });

  it("privacy: ogni richiesta porta solo il blocco, mai più del tetto, e mai il nome del file", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(blockReply({}));
    vi.stubGlobal("fetch", fetchSpy);

    await analyzeDocumentWithClaude(doc({ filename: "segreto-medico.pdf" }), CATEGORIES, "once", { segments: SEGMENTS });

    expect(fetchSpy).toHaveBeenCalled();
    for (const [, init] of fetchSpy.mock.calls) {
      const body = JSON.parse(init.body);
      expect(init.body).not.toContain("segreto-medico");
      expect(body).not.toHaveProperty("text");
      if (body.mode === "block") expect(body.block.text.length).toBeLessThanOrEqual(MAX_BLOCK_CHARS);
    }
  });

  it("il tetto per sessione ferma l'analisi prima di mandare qualsiasi cosa", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(blockReply({}));
    vi.stubGlobal("fetch", fetchSpy);

    for (let i = 0; i < MAX_REQUESTS_PER_SESSION; i++) {
      await analyzeDocumentWithClaude(doc(), CATEGORIES, "once");
    }
    fetchSpy.mockClear();

    await expect(analyzeDocumentWithClaude(doc(), CATEGORIES, "once")).rejects.toThrow("sessione");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("planAnalysis e messaggio di conferma", () => {
  it("un documento breve parte in una parte e il messaggio resta quello di sempre", () => {
    const plan = planAnalysis({ extractedText: TEXT });
    expect(plan).toEqual({ parts: 1, truncated: false });
    expect(analysisConfirmMessage(plan)).toBe("Il testo di questo documento verrà inviato a Hinthia. Continuare?");
  });

  it("un documento lungo dice in quante parti parte", () => {
    const text = "Una frase di prova abbastanza lunga. ".repeat(1000);
    const plan = planAnalysis({ extractedText: text });
    expect(plan.parts).toBeGreaterThan(1);
    expect(analysisConfirmMessage(plan)).toContain(`in ${plan.parts} parti`);
  });

  it("oltre il tetto per documento avvisa che si legge solo una parte", () => {
    const text = "Una frase di prova abbastanza lunga. ".repeat(8000);
    const plan = planAnalysis({ extractedText: text });
    expect(plan.truncated).toBe(true);
    expect(analysisConfirmMessage(plan)).toContain("solo le prime");
  });
});

describe("buildAIProposals", () => {
  const PROV = { segmentId: "s1", page: null };
  const FIELDS: AIExtractedFields = {
    expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027.", provenance: PROV }],
    issuer: [{ value: "GENERALI ITALIA S.p.A.", source: "GENERALI ITALIA S.p.A.", provenance: PROV }],
    category: { value: "cat-assicurazioni", source: "Polizza", provenance: PROV },
    fields: [
      {
        key: "numero_polizza",
        label: "Numero polizza",
        value: "IT-4471-2027",
        source: "Numero polizza: IT-4471-2027",
        provenance: PROV,
      },
    ],
    synthesis: "Una sintesi qualunque.",
    documentType: "polizza",
    coverage: { blocksAnalyzed: 1, blocksTotal: 1, truncated: false },
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
