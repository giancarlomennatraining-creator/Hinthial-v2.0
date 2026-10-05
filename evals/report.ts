import { summarize, valuesMatch, type DocScore, type Prediction, type Summary } from "./score";
import { resolveAnalysisSchema } from "@/domain/ai/analysis/schemas";
import type { EvalDocument } from "./types";

export interface DocResult {
  id: string;
  label: string;
  type: string;
  score: DocScore;
  prediction: Prediction;
  calls: number;
  ms: number;
  charsSent: number;
  error?: string;
}

const pct = (value: number | null) => (value === null ? "   - " : `${(value * 100).toFixed(0).padStart(3)}%`);

/** Ciò che non torna in un documento, in righe leggibili: serve a capire cosa correggere, non solo a contare. */
export function problemsOf(document: EvalDocument, result: DocResult): string[] {
  const { gold } = document;
  const { score, prediction } = result;
  const problems: string[] = [];

  if (!score.typeOk) problems.push(`tipo: atteso ${gold.type}, letto ${prediction.documentType}`);
  for (const date of gold.expiry.filter((d) => !prediction.expiry.includes(d))) problems.push(`scadenza mancante: ${date}`);
  for (const date of prediction.expiry.filter((d) => !gold.expiry.includes(d))) problems.push(`scadenza in più: ${date}`);
  if (gold.issuer && score.issuer.fn > 0) problems.push(`emittente: atteso "${gold.issuer}", letto [${prediction.issuers.join("; ")}]`);
  if (!gold.issuer && prediction.issuers.length > 0) problems.push(`emittente in più: [${prediction.issuers.join("; ")}]`);
  if (!score.categoryOk) problems.push(`categoria: attesa ${gold.category?.join("/") ?? "nessuna"}, letta ${prediction.categoryName ?? "nessuna"}`);

  for (const [key, value] of Object.entries(gold.fields)) {
    const valueType = resolveAnalysisSchema(gold.type).fields.find((f) => f.key === key)?.valueType ?? "text";
    const found = prediction.fields.filter((f) => f.key === key);
    if (found.some((f) => valuesMatch(valueType, value, f.value))) continue;
    if (found.length > 0) {
      problems.push(`campo ${key}: atteso "${value}", letto "${found[0].value}"`);
      continue;
    }
    const other = prediction.fields.find((f) => valuesMatch(valueType, value, f.value));
    problems.push(other ? `campo ${key} (${value}): c'è, ma con la chiave "${other.key}"` : `campo mancante: ${key} (${value})`);
  }
  for (const date of gold.events.filter((d) => !prediction.events.includes(d))) problems.push(`evento mancante: ${date}`);
  for (const date of prediction.events.filter((d) => !gold.events.includes(d))) {
    problems.push(gold.notEvents.includes(date) ? `evento sbagliato (data da non ricordare): ${date}` : `evento in più: ${date}`);
  }
  for (const hit of score.forbiddenHits) problems.push(`VALORE VIETATO presente: ${hit}`);
  if (result.error) problems.push(`errore: ${result.error}`);
  return problems;
}

function row(label: string, s: Summary): string {
  return [
    label.padEnd(10),
    String(s.documents).padStart(3),
    pct(s.typeAccuracy),
    pct(s.categoryAccuracy),
    `${pct(s.expiry.precision)} ${pct(s.expiry.recall)}`,
    `${pct(s.issuer.precision)} ${pct(s.issuer.recall)}`,
    `${pct(s.fields.recall)}/${pct(s.fields.recallByValue)}`,
    `${pct(s.events.precision)} ${pct(s.events.recall)}`,
    String(s.events.falseEvents).padStart(3),
    String(s.forbiddenHits).padStart(3),
  ].join(" | ");
}

/** Tabella complessiva e per tipo, poi l'elenco dei documenti con problemi. */
export function formatReport(provider: string, documents: EvalDocument[], results: DocResult[]): string {
  const byId = new Map(documents.map((d) => [d.id, d]));
  const header = ["tipo".padEnd(10), "doc", "tipo", "cat.", "scad. P   R", "emitt. P   R", "campi ch./val.", "eventi P   R", "ev.X", "vie."].join(" | ");
  const lines: string[] = [`Motore: ${provider} - ${results.length} documenti`, "", header, "-".repeat(header.length)];

  lines.push(row("TUTTI", summarize(results.map((r) => r.score))));
  const types = [...new Set(results.map((r) => r.type))].sort();
  for (const type of types) {
    lines.push(row(type, summarize(results.filter((r) => r.type === type).map((r) => r.score))));
  }

  const calls = results.reduce((n, r) => n + r.calls, 0);
  const ms = results.reduce((n, r) => n + r.ms, 0);
  const chars = results.reduce((n, r) => n + r.charsSent, 0);
  lines.push("", `Richieste: ${calls} - testo inviato: ${chars.toLocaleString("it-IT")} caratteri - tempo medio per documento: ${(ms / Math.max(results.length, 1) / 1000).toFixed(1)} s`);
  lines.push("Legenda: P = precisione, R = completezza; ev.X = eventi dati su date che non andavano ricordate; vie. = valori vietati comparsi.");

  const withProblems = results.map((r) => ({ r, problems: problemsOf(byId.get(r.id) as EvalDocument, r) })).filter((x) => x.problems.length > 0);
  lines.push("", `Documenti con problemi: ${withProblems.length} su ${results.length}`);
  for (const { r, problems } of withProblems) {
    lines.push(`- ${r.id} (${r.label})`);
    for (const problem of problems) lines.push(`    ${problem}`);
  }
  return lines.join("\n");
}
