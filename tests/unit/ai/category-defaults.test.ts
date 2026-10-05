import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_BY_TYPE, defaultCategoryFor } from "@/domain/ai/analysis/category-defaults";
import { ANALYSIS_DOCUMENT_TYPES } from "@/domain/ai/analysis/schemas";
import { buildAIProposals, extractedFieldsFrom } from "@/domain/ai/analyze-document";
import type { PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";

const CATEGORIES = [
  { id: "c-casa", name: "Casa" },
  { id: "c-ass", name: "Assicurazioni" },
  { id: "c-altro", name: "Altro" },
];

describe("defaultCategoryFor", () => {
  it("sceglie la categoria dell'utente che corrisponde al tipo, senza badare alle maiuscole", () => {
    expect(defaultCategoryFor("bolletta", CATEGORIES)).toEqual({ id: "c-casa", name: "Casa" });
    expect(defaultCategoryFor("polizza", [{ id: "x", name: " ASSICURAZIONI " }])).toEqual({ id: "x", name: "Assicurazioni" });
  });

  it("non propone niente per i tipi ambigui o sconosciuti, né se la categoria non c'è più", () => {
    expect(defaultCategoryFor("verbale", CATEGORIES)).toBeNull();
    expect(defaultCategoryFor("certificato", CATEGORIES)).toBeNull();
    expect(defaultCategoryFor("generico", CATEGORIES)).toBeNull();
    expect(defaultCategoryFor(null, CATEGORIES)).toBeNull();
    expect(defaultCategoryFor("ricetta", CATEGORIES)).toBeNull();
    // L'utente ha rinominato o eliminato "Assicurazioni".
    expect(defaultCategoryFor("polizza", [{ id: "c-casa", name: "Casa" }])).toBeNull();
    expect(defaultCategoryFor("polizza", [{ id: "x" }])).toBeNull();
  });

  it("la tabella parla solo di tipi che esistono nel registro", () => {
    for (const type of Object.keys(DEFAULT_CATEGORY_BY_TYPE)) {
      expect((ANALYSIS_DOCUMENT_TYPES as readonly string[]).includes(type)).toBe(true);
    }
  });
});

function analysis(over: Partial<PersistedContentAnalysis> = {}): PersistedContentAnalysis {
  return {
    v: 1,
    fingerprint: "f",
    schemaVersion: 1,
    pipelineVersion: 4,
    models: { block: "b", merge: "m" },
    documentType: "bolletta",
    blocksTotal: 1,
    blocksTotalBeforeCap: 1,
    truncated: false,
    blocks: [{ expiry: [], issuer: [], category: null, fields: [], events: [], synthesis: null }],
    synthesis: null,
    mergeDone: true,
    updatedAt: "2026-10-05T00:00:00Z",
    ...over,
  };
}

describe("la categoria dal tipo nella lettura salvata", () => {
  it("senza una categoria dal motore, si ricava dal tipo e si segna come calcolata", () => {
    const fields = extractedFieldsFrom(analysis(), CATEGORIES);
    expect(fields.category).toMatchObject({ derived: true, value: "c-casa", source: "Dal tipo di documento: Bolletta" });

    const proposals = buildAIProposals({ expiresAt: null, issuer: "", categoryId: null, structuredFields: {} }, fields, []);
    expect(proposals).toContainEqual(
      expect.objectContaining({ kind: "category", value: "c-casa", derived: true, aiGenerated: true }),
    );
  });

  it("una categoria data dal motore vince sul ripiego", () => {
    const withModelCategory = analysis({
      blocks: [
        {
          expiry: [],
          issuer: [],
          category: { value: "c-altro", source: "Bolletta", provenance: { segmentId: "p1", page: 1 } },
          fields: [],
          events: [],
          synthesis: null,
        },
      ],
    });
    const fields = extractedFieldsFrom(withModelCategory, CATEGORIES);
    expect(fields.category).toMatchObject({ value: "c-altro" });
    expect(fields.category?.derived).toBeUndefined();
  });

  it("non propone la categoria se il documento ne ha già una", () => {
    const fields = extractedFieldsFrom(analysis(), CATEGORIES);
    const proposals = buildAIProposals({ expiresAt: null, issuer: "", categoryId: "c-ass", structuredFields: {} }, fields, []);
    expect(proposals.some((p) => p.kind === "category")).toBe(false);
  });

  it("un tipo ambiguo resta senza categoria", () => {
    expect(extractedFieldsFrom(analysis({ documentType: "verbale" }), CATEGORIES).category).toBeNull();
  });
});
