import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPendingProposals, summarizePending } from "@/domain/dashboard/proposals";
import type { SummaryContext } from "@/domain/ai/types";

const getDocumentById = vi.fn();
const listProposalRejections = vi.fn();
const proposalsByDoc: Record<string, number> = {};

vi.mock("@/domain/documents/repository", () => ({ getDocumentById: (...args: unknown[]) => getDocumentById(...args) }));
vi.mock("@/domain/proposals/repository", () => ({ listProposalRejections: (...args: unknown[]) => listProposalRejections(...args) }));
vi.mock("@/domain/categories/type-categories", () => ({ listTypeCategoryOverrides: () => Promise.resolve({}) }));
vi.mock("@/domain/ai/analyze-document", () => ({
  extractedFieldsFrom: () => ({}),
  buildAIProposals: (doc: { id: string }) => Array.from({ length: proposalsByDoc[doc.id] ?? 0 }, (_, i) => ({ kind: "field", value: String(i) })),
}));

const NOW = new Date(2026, 9, 7, 10, 30);

function summary(id: string, analysisStatus: string | null, updated = "2026-10-01T00:00:00Z") {
  return { id, filename: `${id}.pdf`, analysisStatus, analysisUpdatedAt: updated, createdAt: "2026-01-01T00:00:00Z" };
}

function context(documents: unknown[]): SummaryContext {
  return { categories: [], assets: [], documents, reminders: [], friends: [], capsules: [] } as unknown as SummaryContext;
}

beforeEach(() => {
  getDocumentById.mockReset().mockImplementation(async (_s: unknown, _k: unknown, id: string) => ({ id, filename: `${id}.pdf`, contentAnalysis: {} }));
  listProposalRejections.mockReset().mockResolvedValue([]);
  for (const key of Object.keys(proposalsByDoc)) delete proposalsByDoc[key];
});

describe("summarizePending", () => {
  it("somma le proposte dei soli documenti che ne hanno, e indica il primo da aprire", () => {
    const result = summarizePending([
      { id: "a", filename: "a.pdf", count: 0 },
      { id: "b", filename: "b.pdf", count: 2 },
      { id: "c", filename: "c.pdf", count: 3 },
    ]);
    expect(result).toEqual({ documents: 2, proposals: 5, first: { id: "b", filename: "b.pdf", count: 2 } });
  });

  it("senza proposte non c'è nulla da mostrare", () => {
    expect(summarizePending([{ id: "a", filename: "a.pdf", count: 0 }])).toEqual({ documents: 0, proposals: 0, first: null });
  });
});

describe("loadPendingProposals", () => {
  it("guarda solo i documenti già letti da Hinthia, i più recenti per primi", async () => {
    proposalsByDoc.old = 1;
    proposalsByDoc.fresh = 2;
    const result = await loadPendingProposals(
      {} as never,
      {} as CryptoKey,
      context([summary("old", "done", "2026-09-01T00:00:00Z"), summary("unread", null), summary("fresh", "done", "2026-10-05T00:00:00Z")]),
      NOW,
    );

    expect(getDocumentById).toHaveBeenCalledTimes(2);
    expect(getDocumentById.mock.calls.map((c) => c[2]).sort()).toEqual(["fresh", "old"]);
    expect(result.proposals).toBe(3);
    expect(result.documents).toBe(2);
    expect(result.first?.id).toBe("fresh");
  });

  it("senza documenti letti non legge nulla", async () => {
    const result = await loadPendingProposals({} as never, {} as CryptoKey, context([summary("a", null)]), NOW);
    expect(result).toEqual({ documents: 0, proposals: 0, first: null });
    expect(getDocumentById).not.toHaveBeenCalled();
  });

  it("un documento che non si legge non nasconde l'avviso per gli altri", async () => {
    proposalsByDoc.good = 2;
    getDocumentById.mockImplementation(async (_s: unknown, _k: unknown, id: string) => {
      if (id === "broken") throw new Error("rete");
      return { id, filename: `${id}.pdf`, contentAnalysis: {} };
    });
    const result = await loadPendingProposals({} as never, {} as CryptoKey, context([summary("broken", "done"), summary("good", "done")]), NOW);

    expect(result.proposals).toBe(2);
    expect(result.first?.id).toBe("good");
  });

  it("guarda al massimo 12 documenti", async () => {
    const many = Array.from({ length: 20 }, (_, i) => summary(`d${i}`, "done", `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    await loadPendingProposals({} as never, {} as CryptoKey, context(many), NOW);
    expect(getDocumentById).toHaveBeenCalledTimes(12);
  });
});
