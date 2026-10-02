import { describe, expect, it } from "vitest";
import { buildAnalysisOverview } from "@/domain/ai/analysis/overview";
import type { PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import type { ValidatedBlock } from "@/domain/ai/analysis/validate";

const prov = (page: number | null) => ({ segmentId: page ? `p${page}` : "s1", page });

const BLOCK: ValidatedBlock = {
  expiry: [{ value: "2027-06-03", source: "Valida fino al 3 giugno 2027.", provenance: prov(2) }],
  issuer: [{ value: "Generali", source: "Generali Italia S.p.A.", provenance: prov(1) }],
  category: { value: "cat-ass", source: "Polizza assicurativa", provenance: prov(1) },
  fields: [
    { key: "numero_polizza", label: "Numero polizza", value: "IT-4471", source: "Polizza n. IT-4471", provenance: prov(1) },
  ],
  events: [{ title: "Rinnovo", value: "2027-05-01", source: "rinnovo entro il 1 maggio 2027", provenance: prov(2) }],
  synthesis: null,
};

function analysis(over: Partial<PersistedContentAnalysis> = {}): PersistedContentAnalysis {
  return {
    v: 1,
    fingerprint: "f",
    schemaVersion: 1,
    pipelineVersion: 2,
    models: { block: "b", merge: "m" },
    documentType: "polizza",
    blocksTotal: 1,
    blocksTotalBeforeCap: 1,
    truncated: false,
    blocks: [BLOCK],
    synthesis: "x",
    mergeDone: true,
    updatedAt: "2026-10-02T00:00:00Z",
    ...over,
  };
}

const CATEGORIES = [{ id: "cat-ass", name: "Assicurazioni" }];
const EMPTY_DOC = { categoryId: null, expiresAt: null, issuer: "", structuredFields: {} };

describe("buildAnalysisOverview", () => {
  it("elenca tipo e dati con la provenienza, senza mostrare l'id della categoria", () => {
    const overview = buildAnalysisOverview(analysis(), EMPTY_DOC, CATEGORIES, []);
    expect(overview.typeLabel).toBe("Polizza assicurativa");
    expect(overview.typeRecognized).toBe(true);
    expect(overview.facts.map((f) => [f.kind, f.value])).toEqual([
      ["category", "Assicurazioni"],
      ["expiry", "2027-06-03"],
      ["issuer", "Generali"],
      ["field", "IT-4471"],
      ["event", "2027-05-01"],
    ]);
    expect(overview.facts.find((f) => f.kind === "expiry")).toMatchObject({
      valueType: "date",
      quote: "Valida fino al 3 giugno 2027.",
      provenance: { page: 2 },
      adopted: false,
    });
  });

  it("segna come già tuo ciò che è nella Scheda o in Scadenze", () => {
    const overview = buildAnalysisOverview(
      analysis(),
      {
        categoryId: "cat-ass",
        expiresAt: "2027-06-03",
        issuer: "generali",
        structuredFields: { numero_polizza: "IT-4471" },
      },
      CATEGORIES,
      ["2027-05-01"],
    );
    expect(overview.facts.every((f) => f.adopted)).toBe(true);
  });

  it("non segna come tuo un valore diverso", () => {
    const overview = buildAnalysisOverview(
      analysis(),
      { ...EMPTY_DOC, expiresAt: "2028-01-01", structuredFields: { numero_polizza: "ALTRO" } },
      CATEGORIES,
      [],
    );
    expect(overview.facts.some((f) => f.adopted)).toBe(false);
  });

  it("scarta una categoria eliminata dopo la lettura", () => {
    const overview = buildAnalysisOverview(analysis(), EMPTY_DOC, [], []);
    expect(overview.facts.some((f) => f.kind === "category")).toBe(false);
  });

  it("un tipo generico (o mancante) non finge di essere riconosciuto", () => {
    expect(buildAnalysisOverview(analysis({ documentType: "generico" }), EMPTY_DOC, CATEGORIES, [])).toMatchObject({
      typeLabel: "Documento generico",
      typeRecognized: false,
    });
    expect(buildAnalysisOverview(analysis({ documentType: null }), EMPTY_DOC, CATEGORIES, []).typeRecognized).toBe(false);
  });

  it("riporta la copertura quando il documento è stato letto solo in parte", () => {
    const overview = buildAnalysisOverview(analysis({ truncated: true, blocksTotalBeforeCap: 9 }), EMPTY_DOC, CATEGORIES, []);
    expect(overview.coverage).toEqual({ read: 1, total: 9, truncated: true });
  });
});
