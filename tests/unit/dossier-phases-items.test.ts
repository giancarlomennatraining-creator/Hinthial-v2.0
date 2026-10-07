import { describe, expect, it } from "vitest";
import {
  MAX_PHASES,
  normalizePhases,
  parsePhaseNames,
  parseStoredPhases,
  phaseState,
  serializePhases,
} from "@/domain/dossiers/phases";
import { initialsOf, parsePersonData, parseStepData, sortSteps, type DossierStep } from "@/domain/dossiers/items";
import { dossierDeadlines } from "@/domain/dossiers/overview";

const NOW = new Date(2026, 9, 7, 12, 0, 0);

describe("parsePhaseNames", () => {
  it("separa per virgola, punto e virgola e a capo, senza vuoti né doppioni", () => {
    expect(parsePhaseNames("Visite, Esami;\nCura,  , visite")).toEqual(["Visite", "Esami", "Cura"]);
  });

  it("limita numero e lunghezza dei nomi", () => {
    const many = Array.from({ length: 12 }, (_, i) => `Fase ${i + 1}`).join(",");
    expect(parsePhaseNames(many)).toHaveLength(MAX_PHASES);
    expect(parsePhaseNames("x".repeat(80))[0]).toHaveLength(30);
  });
});

describe("normalizePhases e parseStoredPhases", () => {
  it("riporta un indice fuori dall'elenco dentro l'elenco", () => {
    expect(normalizePhases({ names: ["A", "B"], current: 9 })).toEqual({ names: ["A", "B"], current: 1 });
    expect(normalizePhases({ names: ["A", "B"], current: -3 })).toEqual({ names: ["A", "B"], current: 0 });
  });

  it("senza nomi non ci sono fasi", () => {
    expect(normalizePhases({ names: [" ", ""], current: 0 })).toBeNull();
  });

  it("fa il giro con serializePhases", () => {
    const phases = { names: ["Mutuo", "Rogito"], current: 1 };
    expect(parseStoredPhases(serializePhases(phases))).toEqual(phases);
  });

  it("un dato guasto vale nessuna fase", () => {
    expect(parseStoredPhases("non json")).toBeNull();
    expect(parseStoredPhases('{"names":[1,2]}')).toBeNull();
    expect(parseStoredPhases("null")).toBeNull();
  });
});

describe("phaseState", () => {
  it("distingue fatte, corrente e da fare", () => {
    const phases = { names: ["A", "B", "C"], current: 1 };
    expect([0, 1, 2].map((i) => phaseState(phases, i))).toEqual(["done", "current", "todo"]);
  });
});

describe("initialsOf", () => {
  it("prende le prime due iniziali", () => {
    expect(initialsOf("Notaio Rossi")).toBe("NR");
    expect(initialsOf("banca delta spa")).toBe("BD");
    expect(initialsOf("Banca")).toBe("B");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("dati di passi e persone", () => {
  it("legge un passo e una persona, e scarta il resto", () => {
    expect(parseStepData('{"text":"Fissare il rogito"}')).toBe("Fissare il rogito");
    expect(parseStepData('{"text":"  "}')).toBeNull();
    expect(parseStepData("rotto")).toBeNull();
    expect(parsePersonData('{"name":"Notaio Rossi","role":"Studio notarile"}')).toEqual({
      name: "Notaio Rossi",
      role: "Studio notarile",
    });
    expect(parsePersonData('{"name":"Anna"}')).toEqual({ name: "Anna", role: "" });
    expect(parsePersonData('{"role":"x"}')).toBeNull();
  });
});

function step(id: string, over: Partial<DossierStep> = {}): DossierStep {
  return { id, dossierId: "F", text: `Passo ${id}`, dueOn: null, done: false, ...over };
}

describe("sortSteps", () => {
  it("prima i passi con data (dal più vicino), poi senza data, poi quelli fatti", () => {
    const sorted = sortSteps([
      step("fatto", { done: true, dueOn: "2026-10-01" }),
      step("senza"),
      step("tardi", { dueOn: "2026-12-01" }),
      step("presto", { dueOn: "2026-10-20" }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual(["presto", "tardi", "senza", "fatto"]);
  });
});

describe("dossierDeadlines con i passi", () => {
  it("conta i passi con data non fatti", () => {
    const deadlines = dossierDeadlines([], [], NOW, [
      step("a", { dueOn: "2026-10-18" }),
      step("b", { dueOn: "2026-10-09", done: true }),
      step("c"),
    ]);
    expect(deadlines.map((d) => [d.kind, d.id])).toEqual([["step", "a"]]);
    expect(deadlines[0].title).toBe("Passo a");
  });
});
