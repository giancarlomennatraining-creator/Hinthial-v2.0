import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { CORPUS } from "./corpus";
import { diagnoseDocument, formatDiagnosis } from "./diagnose";
import { EVAL_CATEGORIES } from "./run-analysis";
import { createEvalProvider } from "./providers";
import { formatReport, type DocResult } from "./report";
import { runAnalysis } from "./run-analysis";
import type { AnalysisProvider, RawBlockAnalysis } from "@/domain/ai/analysis/types";
import { scoreDocument } from "./score";

/**
 * La misura: esegue la catena di analisi su ogni documento di prova con il motore scelto e stampa il rapporto.
 *   npm run eval                              (motore "claude")
 *   EVAL_PROVIDER=empty npm run eval          (nessun motore: il pavimento, senza rete)
 *   EVAL_PROVIDER=ollama EVAL_MODEL=qwen2.5:3b npm run eval   (un modello locale servito da Ollama)
 *   EVAL_ONLY=polizza-rca-generali,bolletta-luce npm run eval
 * Il rapporto completo si salva anche in evals/results/ (ignorata da git).
 */
const PROVIDER = process.env.EVAL_PROVIDER ?? "claude";
const ONLY = process.env.EVAL_ONLY?.split(",").map((id) => id.trim()).filter(Boolean);
// Un modello locale ha una sola CPU/GPU da dividere: più richieste insieme lo rallentano e basta.
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? (PROVIDER === "ollama" ? 1 : 3));
/** Un file di risultati già salvato: si rivaluta senza rifare le chiamate al motore (utile cambiando il punteggio). */
const FROM = process.env.EVAL_FROM;
/** Con EVAL_FROM: rifà la validazione sull'uscita grezza salvata (senza chiamare il motore), per misurare un cambiamento alla validazione. */
const REVALIDATE = Boolean(process.env.EVAL_REVALIDATE);

describe(`misura della lettura (${PROVIDER})`, () => {
  it(
    "esegue il corpus e stampa il rapporto",
    async () => {
      const documents = ONLY ? CORPUS.filter((d) => ONLY.includes(d.id)) : CORPUS;

      if (FROM) {
        const saved = JSON.parse(fs.readFileSync(FROM, "utf-8")) as { provider: string; results: DocResult[] };
        const rescored: DocResult[] = [];
        for (const document of documents) {
          const old = saved.results.find((r) => r.id === document.id) as (DocResult & { raw?: RawBlockAnalysis[] }) | undefined;
          if (!old) continue;
          let { prediction, discarded } = old;
          if (REVALIDATE && old.raw) {
            // Il motore "risponde" con ciò che aveva già risposto: cambia solo la validazione.
            let call = 0;
            const replay: AnalysisProvider = {
              async analyzeBlock() {
                return (old.raw as RawBlockAnalysis[])[call++];
              },
              async mergeSyntheses() {
                return null;
              },
            };
            const rerun = await runAnalysis(document, replay);
            prediction = rerun.prediction;
            discarded = rerun.discarded;
          }
          rescored.push({ ...old, type: document.gold.type, prediction, discarded, score: scoreDocument(document.gold, prediction) });
        }
        let report = formatReport(`${saved.provider} (rivalutato da ${path.basename(FROM)})`, documents, rescored);
        if (process.env.EVAL_DIAGNOSE) {
          // Perché la validazione scarta le letture del motore: serve l'uscita grezza, salvata dalle misure recenti.
          const discarded = documents.flatMap((document) => {
            const result = saved.results.find((r) => r.id === document.id) as (DocResult & { raw?: RawBlockAnalysis[] }) | undefined;
            return result?.raw
              ? diagnoseDocument(document, result.raw, EVAL_CATEGORIES.map((c) => c.id), result.prediction.documentType)
              : [];
          });
          report += `\n\n${formatDiagnosis(discarded)}`;
        }
        process.stdout.write(`
${report}

`);
        fs.writeFileSync(FROM.replace(/\.json$/, "-rivalutato.txt"), report);
        return;
      }

      const provider = createEvalProvider(PROVIDER);
      const results: DocResult[] = new Array(documents.length);

      let next = 0;
      async function worker() {
        while (next < documents.length) {
          const index = next++;
          const document = documents[index];
          try {
            const run = await runAnalysis(document, provider);
            results[index] = {
              id: document.id,
              label: document.label,
              type: document.gold.type,
              score: scoreDocument(document.gold, run.prediction),
              prediction: run.prediction,
              calls: run.calls,
              ms: run.ms,
              charsSent: run.charsSent,
              discarded: run.discarded,
              raw: run.raw,
            } as DocResult & { raw: unknown };
          } catch (error) {
            // Un documento che fallisce conta come "non ha trovato niente", e l'errore resta nel rapporto.
            const empty = { documentType: "generico", expiry: [], issuers: [], categoryName: null, fields: [], events: [], everything: [] };
            results[index] = {
              id: document.id,
              label: document.label,
              type: document.gold.type,
              score: scoreDocument(document.gold, empty),
              prediction: empty,
              calls: 0,
              ms: 0,
              charsSent: 0,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      }
      await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

      const report = formatReport(PROVIDER, documents, results);
      console.log(`\n${report}\n`);

      const dir = path.join(process.cwd(), "evals", "results");
      fs.mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.writeFileSync(path.join(dir, `${PROVIDER}-${stamp}.json`), JSON.stringify({ provider: PROVIDER, results }, null, 2));
      fs.writeFileSync(path.join(dir, `${PROVIDER}-${stamp}.txt`), report);
    },
    30 * 60 * 1000,
  );
});
