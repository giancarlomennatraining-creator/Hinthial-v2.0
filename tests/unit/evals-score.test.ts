import { describe, expect, it } from "vitest";
import { normalizeText, parseAmount, scoreDocument, summarize, valuesMatch, type Prediction } from "../../evals/score";
import type { EvalGold } from "../../evals/types";
import { problemsOf, type DocResult } from "../../evals/report";
import { runAnalysis } from "../../evals/run-analysis";
import type { AnalysisProvider } from "@/domain/ai/analysis/types";

const GOLD: EvalGold = {
  type: "polizza",
  expiry: ["2027-03-14"],
  issuer: "Generali Italia",
  category: ["Assicurazioni", "Veicoli"],
  fields: { numero_polizza: "400/88231907", premio: "612,40" },
  events: ["2027-04-01"],
  notEvents: ["2026-03-10"],
  forbidden: ["2099-12-31"],
};

const PERFECT: Prediction = {
  documentType: "polizza",
  expiry: ["2027-03-14"],
  issuers: ["GENERALI ITALIA S.p.A."],
  categoryName: "Veicoli",
  fields: [
    { key: "numero_polizza", value: "400/88231907" },
    { key: "premio", value: "euro 612,40" },
  ],
  events: ["2027-04-01"],
  everything: [],
};

describe("normalizzazione e confronto dei valori", () => {
  it("normalizza maiuscole, accenti e forme societarie", () => {
    expect(normalizeText("GENERALI ITALIA S.p.A.")).toBe("generali italia");
    expect(normalizeText("Società Verdi S.r.l.")).toBe("societa verdi");
  });

  it("legge gli importi all'italiana", () => {
    expect(parseAmount("euro 1.234,56")).toBe(1234.56);
    expect(parseAmount("€ 612,40 lordi")).toBe(612.4);
    expect(parseAmount("senza cifre")).toBeNull();
  });

  it("confronta secondo il tipo di valore", () => {
    expect(valuesMatch("amount", "612,40", "euro 612,40")).toBe(true);
    expect(valuesMatch("amount", "612,40", "612,50")).toBe(false);
    expect(valuesMatch("identifier", "IT 001-E123", "it001e123")).toBe(true);
    expect(valuesMatch("date", "2027-03-14", "2027-03-14")).toBe(true);
    expect(valuesMatch("text", "FIAT Panda", "Fiat Panda 1.2")).toBe(true);
    expect(valuesMatch("text", "Panda", "Punto")).toBe(false);
  });
});

describe("scoreDocument", () => {
  it("una lettura perfetta prende tutto", () => {
    const score = scoreDocument(GOLD, PERFECT);
    expect(score.typeOk).toBe(true);
    expect(score.categoryOk).toBe(true);
    expect(score.expiry).toEqual({ tp: 1, fp: 0, fn: 0 });
    expect(score.issuer).toEqual({ tp: 1, fp: 0, fn: 0 });
    expect(score.fields).toEqual({ tp: 2, valueOtherKey: 0, wrongValue: 0, extra: 0, gold: 2 });
    expect(score.events).toMatchObject({ tp: 1, fp: 0, fn: 0, falseEvents: 0 });
    expect(score.forbiddenHits).toEqual([]);
  });

  it("conta i dati mancanti, sbagliati e in più, e gli eventi su date da non ricordare", () => {
    const score = scoreDocument(GOLD, {
      ...PERFECT,
      documentType: "contratto",
      expiry: ["2027-03-15"],
      issuers: ["Allianz"],
      categoryName: "Casa",
      fields: [
        { key: "numero_polizza", value: "999" },
        { key: "targa", value: "GH482XP" },
      ],
      events: ["2026-03-10"],
      everything: ["scadenza 2099-12-31"],
    });
    expect(score.typeOk).toBe(false);
    expect(score.categoryOk).toBe(false);
    expect(score.expiry).toEqual({ tp: 0, fp: 1, fn: 1 });
    expect(score.issuer).toEqual({ tp: 0, fp: 1, fn: 1 });
    expect(score.fields).toEqual({ tp: 0, valueOtherKey: 0, wrongValue: 1, extra: 1, gold: 2 });
    expect(score.events).toMatchObject({ tp: 0, fp: 1, fn: 1, falseEvents: 1 });
    expect(score.forbiddenHits).toEqual(["2099-12-31"]);
  });

  it("distingue un valore trovato con un'altra chiave da uno non trovato", () => {
    const score = scoreDocument(GOLD, {
      ...PERFECT,
      fields: [
        { key: "numero_polizza", value: "400/88231907" },
        { key: "premio_annuo", value: "euro 612,40" },
      ],
    });
    expect(score.fields).toEqual({ tp: 1, valueOtherKey: 1, wrongValue: 0, extra: 1, gold: 2 });
    const summary = summarize([score]);
    expect(summary.fields.recall).toBe(0.5);
    expect(summary.fields.recallByValue).toBe(1);
  });

  it("un documento vuoto si legge bene solo se non si inventa niente", () => {
    const empty: EvalGold = { type: "generico", expiry: [], issuer: null, category: null, fields: {}, events: [], notEvents: [] };
    const none: Prediction = { documentType: "generico", expiry: [], issuers: [], categoryName: null, fields: [], events: [], everything: [] };
    expect(scoreDocument(empty, none).categoryOk).toBe(true);
    const invented = scoreDocument(empty, { ...none, issuers: ["X"], categoryName: "Casa", events: ["2027-01-01"] });
    expect(invented.categoryOk).toBe(false);
    expect(invented.issuer.fp).toBe(1);
    expect(invented.events.fp).toBe(1);
  });
});

describe("summarize", () => {
  it("somma i conteggi di tutti i documenti", () => {
    const good = scoreDocument(GOLD, PERFECT);
    const bad = scoreDocument(GOLD, { ...PERFECT, expiry: [], events: [] });
    const summary = summarize([good, bad]);
    expect(summary.documents).toBe(2);
    expect(summary.expiry.recall).toBe(0.5);
    expect(summary.expiry.precision).toBe(1);
    expect(summary.events.recall).toBe(0.5);
    expect(summary.fields.recall).toBe(1);
  });

  it("senza dati attesi le percentuali sono indefinite, non zero", () => {
    const none: Prediction = { documentType: "generico", expiry: [], issuers: [], categoryName: null, fields: [], events: [], everything: [] };
    const empty: EvalGold = { type: "generico", expiry: [], issuer: null, category: null, fields: {}, events: [], notEvents: [] };
    expect(summarize([scoreDocument(empty, none)]).expiry.recall).toBeNull();
  });
});

describe("runAnalysis e rapporto", () => {
  const provider: AnalysisProvider = {
    async analyzeBlock() {
      return {
        documentType: "polizza",
        expiry: [{ value: "2027-03-14", segmentId: "p1", quote: "Scadenza della copertura: 14/03/2027" }],
        issuer: [{ value: "Generali Italia", segmentId: "p1", quote: "GENERALI ITALIA S.p.A." }],
        category: { id: "cat-assicurazioni", segmentId: "p1", quote: "ASSICURAZIONE" },
        // Citazione inventata: la validazione la scarta, come in produzione.
        fields: [{ key: "numero_polizza", label: "Numero polizza", value: "XYZ", segmentId: "p1", quote: "Polizza n. XYZ" }],
        events: [],
        synthesis: null,
      };
    },
    async mergeSyntheses() {
      return null;
    },
  };
  const document = {
    id: "prova",
    label: "Prova",
    pages: ["GENERALI ITALIA S.p.A.\nCERTIFICATO DI ASSICURAZIONE\nScadenza della copertura: 14/03/2027"],
    gold: GOLD,
  };

  it("applica la validazione delle citazioni e traduce le categorie", async () => {
    const run = await runAnalysis(document, provider);
    expect(run.calls).toBe(1);
    expect(run.prediction.expiry).toEqual(["2027-03-14"]);
    expect(run.prediction.issuers).toEqual(["Generali Italia"]);
    expect(run.prediction.categoryName).toBe("Assicurazioni");
    expect(run.prediction.fields).toEqual([]);
  });

  it("il rapporto elenca cosa manca", async () => {
    const run = await runAnalysis(document, provider);
    const result: DocResult = {
      id: document.id,
      label: document.label,
      type: document.gold.type,
      score: scoreDocument(document.gold, run.prediction),
      prediction: run.prediction,
      calls: run.calls,
      ms: run.ms,
      charsSent: run.charsSent,
    };
    const problems = problemsOf(document, result);
    expect(problems).toContain("campo mancante: numero_polizza (400/88231907)");
    expect(problems).toContain("evento mancante: 2027-04-01");
  });
});
