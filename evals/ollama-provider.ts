import { buildBlockMessage, buildBlockSystemPrompt, buildOutputSchema } from "@/domain/ai/analysis/prompt";
import { parseBlockAnalysis } from "@/domain/ai/analysis/result";
import {
  AnalysisOutputError,
  type AnalysisProvider,
  type AnalyzeBlockInput,
  type RawBlockAnalysis,
} from "@/domain/ai/analysis/types";

/**
 * Un modello locale servito da Ollama (https://ollama.com), per misurare quanto un modello piccolo si avvicina ad
 * Anthropic con le stesse istruzioni, lo stesso schema e la stessa validazione. Solo per evals/: nessun codice di
 * produzione lo usa. Il modello è vincolato allo schema JSON (`format`), così l'uscita ha sempre la forma giusta;
 * resta da vedere se le citazioni sono esatte, ed è ciò che la validazione verifica.
 */

const DEFAULT_URL = "http://localhost:11434";
/** Un modello su CPU impiega minuti per blocco: meglio aspettare che fallire. */
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;
const BLOCK_ATTEMPTS = 2;

type OllamaOptions = {
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

type OllamaChatResponse = { message?: { content?: string } };

export function createOllamaAnalysisProvider({ model, baseUrl = DEFAULT_URL, fetchImpl = fetch }: OllamaOptions): AnalysisProvider {
  const system = buildBlockSystemPrompt("rispondendo con un solo oggetto JSON conforme allo schema");
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/chat`;

  async function chat(input: AnalyzeBlockInput): Promise<string> {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          format: buildOutputSchema(input.documentType === null),
          options: { temperature: 0 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: buildBlockMessage(input) },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new Error(
        `Ollama non risponde su ${baseUrl}: è installato e avviato? (${cause instanceof Error ? cause.message : String(cause)})`,
      );
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(
        `Ollama ha risposto ${response.status}${detail ? `: ${detail}` : ""}. Il modello "${model}" è stato scaricato? (ollama pull ${model})`,
      );
    }
    const body = (await response.json()) as OllamaChatResponse;
    return body.message?.content ?? "";
  }

  return {
    async analyzeBlock(input: AnalyzeBlockInput): Promise<RawBlockAnalysis> {
      for (let attempt = 1; attempt <= BLOCK_ATTEMPTS; attempt += 1) {
        const content = await chat(input);
        let json: unknown = null;
        try {
          json = JSON.parse(content);
        } catch {
          // Un JSON troncato o rovinato: si riprova, come per il provider Claude.
        }
        const parsed = json ? parseBlockAnalysis(json) : null;
        if (parsed) return parsed;
      }
      throw new AnalysisOutputError();
    },

    // Le sintesi parziali restano com'è: la sintesi unica è un compito di chat, da misurare a parte.
    async mergeSyntheses(): Promise<string | null> {
      return null;
    },
  };
}
