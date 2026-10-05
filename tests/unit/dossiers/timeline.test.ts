/**
 * FASE 20 --- la cronologia di un fascicolo.
 */
import { describe, expect, it } from "vitest";
import { buildDossierTimeline } from "@/domain/dossiers/timeline";

describe("la cronologia", () => {
  it("ordina per data di caricamento, dal più vecchio al più recente", () => {
    const timeline = buildDossierTimeline([
      { id: "recente", createdAt: "2026-06-01T00:00:00Z" },
      { id: "vecchio", createdAt: "2026-01-01T00:00:00Z" },
      { id: "medio", createdAt: "2026-03-15T12:00:00Z" },
    ]);

    expect(timeline.map((entry) => entry.document.id)).toEqual(["vecchio", "medio", "recente"]);
    expect(timeline[0].date).toBe("2026-01-01T00:00:00Z");
  });

  it("un fascicolo senza documenti ha una cronologia vuota", () => {
    expect(buildDossierTimeline([])).toEqual([]);
  });
});
