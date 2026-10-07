import { describe, expect, it } from "vitest";
import { MAX_PHASE_NAME_LENGTH, MAX_PHASES } from "@/domain/dossiers/phases";
import { DOSSIER_TEMPLATES, findTemplateMatches, templateMeta } from "@/domain/dossiers/templates";
import { matchExpected } from "@/domain/dossiers/expected";

function doc(id: string, filename: string, over: Record<string, unknown> = {}) {
  return { id, filename, issuer: "", notes: "", tags: [] as string[], structuredFields: {}, dossierIds: [] as string[], ...over };
}

describe("i modelli", () => {
  it("hanno identificativi e nomi diversi, e fasi e voci nei limiti", () => {
    expect(new Set(DOSSIER_TEMPLATES.map((t) => t.id)).size).toBe(DOSSIER_TEMPLATES.length);
    expect(new Set(DOSSIER_TEMPLATES.map((t) => t.name)).size).toBe(DOSSIER_TEMPLATES.length);
    for (const template of DOSSIER_TEMPLATES) {
      expect(template.phases.length).toBeGreaterThan(0);
      expect(template.phases.length).toBeLessThanOrEqual(MAX_PHASES);
      for (const phase of template.phases) expect(phase.length).toBeLessThanOrEqual(MAX_PHASE_NAME_LENGTH);
      expect(new Set(template.phases.map((p) => p.toLowerCase())).size).toBe(template.phases.length);
      expect(template.expected.length).toBeGreaterThan(0);
    }
  });

  it("ogni voce ha parole significative: si può abbinare a un documento", () => {
    for (const template of DOSSIER_TEMPLATES) {
      for (const label of template.expected) {
        // Un documento che si chiama come la voce la soddisfa: se non succede, la voce resterebbe sempre da spuntare a mano.
        const summary = matchExpected([{ id: "x", label, done: false }], [doc("d", `${label}.pdf`)] as never);
        expect(summary.statuses[0].documentId, label).toBe("d");
      }
    }
  });

  it("descrivono quante fasi e quanti documenti attesi hanno", () => {
    const casa = DOSSIER_TEMPLATES.find((t) => t.id === "casa")!;
    expect(templateMeta(casa)).toBe("5 fasi · 8 documenti attesi");
  });
});

describe("findTemplateMatches", () => {
  const casa = DOSSIER_TEMPLATES.find((t) => t.id === "casa")!;

  it("trova i documenti che nominano una voce del modello", () => {
    const matches = findTemplateMatches(casa, [
      doc("a", "Visura catastale Via Roma.pdf"),
      doc("b", "Preliminare di compravendita.pdf"),
      doc("c", "Bolletta luce.pdf"),
    ]);
    expect(matches.map((m) => [m.documentId, m.expectedLabel])).toEqual([
      ["b", "Preliminare di compravendita"],
      ["a", "Visura catastale"],
    ]);
  });

  it("non propone documenti che stanno già in un fascicolo", () => {
    expect(findTemplateMatches(casa, [doc("a", "Visura catastale.pdf", { dossierIds: ["F"] })])).toEqual([]);
  });

  it("senza documenti o senza corrispondenze non propone niente", () => {
    expect(findTemplateMatches(casa, [])).toEqual([]);
    expect(findTemplateMatches(casa, [doc("a", "Ricetta.jpg")])).toEqual([]);
  });
});
