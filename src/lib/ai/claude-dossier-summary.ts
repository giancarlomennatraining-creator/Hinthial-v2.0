import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_MODELS } from "@/domain/ai/analysis/pipeline";
import {
  buildSummaryMessage,
  DOSSIER_SUMMARY_SYSTEM_PROMPT,
  type DossierSummaryRequest,
} from "@/domain/ai/dossier-summary";

const SUMMARY_MAX_TOKENS = 700;

/** Il riassunto di un fascicolo: l'unico punto che parla con Anthropic per questo (v. api/ai/dossier-summary/route.ts). */
export async function summarizeDossierWithClaude(apiKey: string, request: DossierSummaryRequest): Promise<string | null> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ANALYSIS_MODELS.merge,
    max_tokens: SUMMARY_MAX_TOKENS,
    system: DOSSIER_SUMMARY_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildSummaryMessage(request) }],
  });
  const text = response.content.find((block) => block.type === "text")?.text.trim();
  return text ? text : null;
}
