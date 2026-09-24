import type { AISource } from "@/domain/ai/types";

/** Condivise da AI assistant e GlobalSearch, che raggruppano i risultati allo stesso modo. */
export const AI_SOURCE_KIND_LABELS: Record<AISource["kind"], string> = {
  asset: "Beni",
  document: "Archivio",
  reminder: "Scadenze",
  friend: "Amici",
  capsule: "Capsule",
};
