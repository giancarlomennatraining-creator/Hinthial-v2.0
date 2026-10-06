import { createOllamaAnalysisProvider } from "./ollama-provider";
import { createClaudeAnalysisProvider } from "@/lib/ai/claude-analysis-provider";
import type { AnalysisProvider, RawBlockAnalysis } from "@/domain/ai/analysis/types";

/** Un motore che non trova mai niente: il "pavimento" della misura, e il modo di provare il programma senza rete né costi. */
const emptyProvider: AnalysisProvider = {
  async analyzeBlock(): Promise<RawBlockAnalysis> {
    return { documentType: "generico", expiry: [], issuer: [], category: null, fields: [], events: [], synthesis: null };
  },
  async mergeSyntheses() {
    return null;
  },
};

export const DEFAULT_OLLAMA_MODEL = "qwen2.5:3b";

/**
 * I motori confrontabili, scelti con EVAL_PROVIDER. Un motore nuovo (un modello locale, un server) si aggiunge qui
 * implementando AnalysisProvider: la misura è la stessa.
 */
export function createEvalProvider(name: string): AnalysisProvider {
  switch (name) {
    case "empty":
      return emptyProvider;
    case "claude": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY non configurata: il motore \"claude\" ne ha bisogno.");
      return createClaudeAnalysisProvider(apiKey);
    }
    case "ollama":
      // EVAL_MODEL sceglie il modello (da scaricare prima con "ollama pull"); OLLAMA_URL, il server.
      return createOllamaAnalysisProvider({
        model: process.env.EVAL_MODEL ?? DEFAULT_OLLAMA_MODEL,
        baseUrl: process.env.OLLAMA_URL,
      });
    default:
      throw new Error(`Motore sconosciuto: "${name}". Disponibili: claude, ollama, empty.`);
  }
}
