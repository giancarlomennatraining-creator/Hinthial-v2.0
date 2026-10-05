import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_MODELS } from "@/domain/ai/analysis/pipeline";
import { parseBlockAnalysis } from "@/domain/ai/analysis/result";
import { buildBlockMessage, buildBlockSystemPrompt, buildOutputSchema, MERGE_SYSTEM_PROMPT } from "@/domain/ai/analysis/prompt";
import {
  AnalysisOutputError,
  type AnalysisProvider,
  type AnalyzeBlockInput,
  type RawBlockAnalysis,
} from "@/domain/ai/analysis/types";

/**
 * Un modello per stadio (spec §12): la lettura dei blocchi e la fusione delle sintesi sono compiti piccoli e
 * ripetuti, quindi il modello più economico basta. Cambiare uno stadio = cambiare una riga in pipeline.ts, dove
 * serve anche all'impronta delle letture salvate.
 */
const MODELS = ANALYSIS_MODELS;

const BLOCK_MAX_TOKENS = 4096;
const MERGE_MAX_TOKENS = 700;
const BLOCK_ATTEMPTS = 2;
const TOOL_NAME = "report_block_analysis";

const BLOCK_SYSTEM_PROMPT = buildBlockSystemPrompt(`chiamando lo strumento ${TOOL_NAME}`);

function buildTool(askDocumentType: boolean): Anthropic.Tool {
  return {
    name: TOOL_NAME,
    description: "Riporta ciò che hai letto nel blocco, con citazione e segmento di provenienza per ogni lettura.",
    input_schema: buildOutputSchema(askDocumentType),
  };
}

/** I tipi dei campi di primo livello dell'output (es. "fields:string"), senza i valori. */
function describeShape(input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return Array.isArray(input) ? "array" : typeof input;
  return Object.entries(input as Record<string, unknown>)
    .map(([key, value]) => `${key}:${Array.isArray(value) ? "array" : value === null ? "null" : typeof value}`)
    .join(",");
}

/** Il provider Claude: l'unico posto che parla con Anthropic per l'analisi di un documento (v. api/ai/analyze/route.ts). */
export function createClaudeAnalysisProvider(apiKey: string): AnalysisProvider {
  const client = new Anthropic({ apiKey });

  return {
    async analyzeBlock(input: AnalyzeBlockInput): Promise<RawBlockAnalysis> {
      // Un output fuori forma è raro e di solito non si ripete: un secondo tentativo costa poco e evita di fermare la lettura.
      for (let attempt = 1; attempt <= BLOCK_ATTEMPTS; attempt += 1) {
        const response = await client.messages.create({
          model: MODELS.block,
          max_tokens: BLOCK_MAX_TOKENS,
          system: BLOCK_SYSTEM_PROMPT,
          tools: [buildTool(input.documentType === null)],
          tool_choice: { type: "tool", name: TOOL_NAME },
          messages: [{ role: "user", content: buildBlockMessage(input) }],
        });

        const toolUse = response.content.find((block) => block.type === "tool_use");
        const parsed = toolUse ? parseBlockAnalysis(toolUse.input) : null;
        if (parsed) return parsed;

        // Solo la forma, mai il contenuto: serve a capire perché il modello ha risposto fuori schema.
        console.warn(
          `[analyze] output non valido (tentativo ${attempt}/${BLOCK_ATTEMPTS}), stop_reason=${response.stop_reason}, ` +
            `tool_use=${toolUse ? "sì" : "no"}, forma=${describeShape(toolUse?.input)}`,
        );
      }
      throw new AnalysisOutputError();
    },

    async mergeSyntheses(partials: string[]): Promise<string | null> {
      const response = await client.messages.create({
        model: MODELS.merge,
        max_tokens: MERGE_MAX_TOKENS,
        system: MERGE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Sintesi parziali, in ordine:\n${partials.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
          },
        ],
      });
      const text = response.content.find((block) => block.type === "text")?.text.trim();
      return text ? text : null;
    },
  };
}
