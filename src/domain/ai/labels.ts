import type { AISource } from "@/domain/ai/types";

/**
 * Italian label per AISource kind --- shared by the AI assistant
 * (mock-provider.ts, answer() text) and the global search command
 * palette (components/search/GlobalSearch.tsx), which group results
 * the same way.
 */
export const AI_SOURCE_KIND_LABELS: Record<AISource["kind"], string> = {
  asset: "Asset",
  document: "Archivio",
  reminder: "Scadenze",
  contact: "Contatti",
  capsule: "Capsule",
};
