import { afterEach, describe, expect, it, vi } from "vitest";
import { answerWithClaude } from "@/domain/ai/claude-provider";
import type { AIContext } from "@/domain/ai/types";

function buildContext(overrides: Partial<AIContext> = {}): AIContext {
  return {
    categories: [{ id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️" }],
    assets: [
      { id: "asset-auto", name: "Auto Panda", categoryId: "cat-assicurazioni", createdAt: "2026-01-01" },
    ],
    documents: [],
    reminders: [
      {
        id: "rem-rinnovo",
        title: "Rinnovo assicurazione auto",
        dueAt: "2027-03-15T00:00:00.000Z",
        completed: false,
        relatedDocumentId: null,
        relatedDocumentFilename: null,
        relatedAssetId: "asset-auto",
        relatedAssetName: "Auto Panda",
        createdAt: "2026-01-01",
      },
    ],
    friends: [],
    capsules: [],
    ...overrides,
  };
}

describe("answerWithClaude", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("non chiama la rete se il retrieval locale non trova nulla", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await answerWithClaude("qualcosa di inesistente", buildContext());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.text).toContain("Non ho trovato nulla");
  });

  it("invia solo gli elementi pertinenti (mai l'intero vault) e restituisce la risposta del server", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: "La tua assicurazione auto scade il 15/03/2027." }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const context = buildContext();
    const result = await answerWithClaude("quando scade la mia assicurazione auto?", context);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/ai/chat");
    const sentBody = JSON.parse(init.body);
    expect(sentBody.query).toBe("quando scade la mia assicurazione auto?");
    // Solo il bene e la scadenza collegati alla categoria citata --- non
    // tutto il contesto (qui non ci sono altri asset/reminder da escludere
    // solo perché il fixture è piccolo, ma la forma dell'item conferma la
    // proiezione: niente id/href, solo label + dettaglio testuale).
    expect(sentBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "reminder", label: "Rinnovo assicurazione auto" }),
      ]),
    );
    for (const item of sentBody.items) {
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("href");
    }

    expect(result.text).toBe("La tua assicurazione auto scade il 15/03/2027.");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("propaga il messaggio di errore del server (es. consenso non attivo, chiave non configurata)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "L'assistente AI reale non è ancora configurato su questo server." }),
      }),
    );

    await expect(answerWithClaude("quando scade la mia assicurazione auto?", buildContext())).rejects.toThrow(
      "L'assistente AI reale non è ancora configurato su questo server.",
    );
  });
});
