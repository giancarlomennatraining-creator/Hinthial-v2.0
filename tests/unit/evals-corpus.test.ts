import { describe, expect, it } from "vitest";
import { CORPUS } from "../../evals/corpus";
import { EVAL_CATEGORIES } from "../../evals/run-analysis";
import { normalizeIdentifier, normalizeText } from "../../evals/score";
import { findDateContext } from "@/domain/extraction/date-context";
import { ANALYSIS_SCHEMAS } from "@/domain/ai/analysis/schemas";

/**
 * Controlla le risposte giuste dei documenti di prova contro i documenti stessi: se un dato annotato non compare nel
 * testo, l'errore è nell'annotazione e non nel motore che si sta misurando.
 */
const TODAY = "2026-10-05";
const CATEGORY_NAMES = new Set(EVAL_CATEGORIES.map((c) => c.name));

describe("corpus di prova", () => {
  it("ha identificatori unici e copre tutti i tipi del registro", () => {
    const ids = CORPUS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const types = new Set(CORPUS.map((d) => d.gold.type));
    for (const type of Object.keys(ANALYSIS_SCHEMAS)) expect(types.has(type as never)).toBe(true);
  });

  for (const document of CORPUS) {
    describe(document.id, () => {
      const text = document.pages.join("\n\n");
      const { gold } = document;

      it("ogni data annotata è scritta nel testo", () => {
        if (document.dirty) return;
        for (const date of [...gold.expiry, ...gold.events, ...gold.notEvents]) {
          expect(findDateContext(text, date), `data ${date} non trovata`).not.toBeNull();
        }
      });

      it("gli eventi sono futuri e distinti dalle date da non ricordare", () => {
        for (const date of gold.events) expect(date > TODAY, `evento ${date} non futuro`).toBe(true);
        // Una scadenza di pagamento vale sia come scadenza del documento sia come evento: le due liste possono coincidere.
        for (const date of gold.events) expect(gold.notEvents).not.toContain(date);
        for (const date of gold.expiry) expect(gold.notEvents).not.toContain(date);
      });

      it("emittente e campi compaiono nel testo, con chiavi del registro", () => {
        if (document.dirty) {
          for (const key of Object.keys(gold.fields)) expect(ANALYSIS_SCHEMAS[gold.type].fields.some((f) => f.key === key)).toBe(true);
          return;
        }
        if (gold.issuer) expect(normalizeText(text)).toContain(normalizeText(gold.issuer));

        const schema = ANALYSIS_SCHEMAS[gold.type];
        for (const [key, value] of Object.entries(gold.fields)) {
          const field = schema.fields.find((f) => f.key === key);
          expect(field, `chiave ${key} non nello schema ${gold.type}`).toBeDefined();
          if (field?.valueType === "date") {
            expect(findDateContext(text, value), `campo ${key}`).not.toBeNull();
          } else if (field?.valueType === "identifier") {
            expect(normalizeIdentifier(text), `campo ${key}`).toContain(normalizeIdentifier(value));
          } else if (field?.valueType === "amount") {
            expect(text, `campo ${key}`).toContain(value);
          } else {
            expect(normalizeText(text), `campo ${key}`).toContain(normalizeText(value));
          }
        }
      });

      it("le categorie accettabili esistono e i valori vietati sono nel testo", () => {
        for (const name of gold.category ?? []) expect(CATEGORY_NAMES.has(name), `categoria ${name}`).toBe(true);
        for (const forbidden of gold.forbidden ?? []) {
          // Una data vietata può essere scritta in formato italiano: si cerca la forma ISO tra le date del testo.
          const isDate = /^\d{4}-\d{2}-\d{2}$/.test(forbidden);
          if (isDate) expect(findDateContext(text, forbidden)).not.toBeNull();
          else expect(text.toLowerCase()).toContain(forbidden.toLowerCase());
        }
      });
    });
  }
});
