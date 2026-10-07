import type { DossierSummaryRequest } from "@/domain/ai/dossier-summary";

export interface DossierSummaryResult {
  summary: string;
  /** Quanti documenti sono entrati nel riassunto. */
  used: number;
  /** Quanti sono rimasti fuori (esclusi dall'analisi o di una categoria non abilitata). */
  skipped: number;
}

/** Chiede a Hinthia il riassunto: il server ricontrolla i consensi e risponde con un messaggio leggibile se non si può. */
export async function requestDossierSummary(request: DossierSummaryRequest): Promise<DossierSummaryResult> {
  const response = await fetch("/api/ai/dossier-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await response.json().catch(() => null)) as
    | { summary?: unknown; used?: unknown; skipped?: unknown; error?: unknown }
    | null;

  if (!response.ok || !body || typeof body.summary !== "string") {
    throw new Error(typeof body?.error === "string" ? body.error : "Impossibile scrivere il riassunto.");
  }
  return {
    summary: body.summary,
    used: typeof body.used === "number" ? body.used : request.documents.length,
    skipped: typeof body.skipped === "number" ? body.skipped : 0,
  };
}
