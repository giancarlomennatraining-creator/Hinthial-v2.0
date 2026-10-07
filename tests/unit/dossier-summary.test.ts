import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSummaryMessage,
  buildSummaryRequest,
  isSummaryStale,
  MAX_SUMMARY_DOCUMENTS,
  parseSummaryRequest,
  readableDocumentCount,
} from "@/domain/ai/dossier-summary";

function doc(id: string, over: Partial<Parameters<typeof buildSummaryRequest>[1][number]> = {}) {
  return {
    id,
    filename: `${id}.pdf`,
    createdAt: "2026-09-10T10:00:00Z",
    aiSynthesis: `Sintesi di ${id}.`,
    structuredFields: {},
    ...over,
  };
}

describe("buildSummaryRequest", () => {
  it("prende solo i documenti già letti, in ordine di data", () => {
    const request = buildSummaryRequest("Acquisto casa", [
      doc("b", { createdAt: "2026-10-01T10:00:00Z" }),
      doc("senza", { aiSynthesis: "  " }),
      doc("a", { createdAt: "2026-09-01T10:00:00Z" }),
    ]);
    expect(request.title).toBe("Acquisto casa");
    expect(request.documents.map((d) => d.id)).toEqual(["a", "b"]);
    expect(request.documents[0].date).toBe("2026-09-01");
  });

  it("tiene i più recenti se sono troppi, e taglia sintesi e campi", () => {
    const many = Array.from({ length: MAX_SUMMARY_DOCUMENTS + 5 }, (_, i) =>
      doc(`d${String(i).padStart(2, "0")}`, { createdAt: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z` }),
    );
    expect(buildSummaryRequest("x", many).documents).toHaveLength(MAX_SUMMARY_DOCUMENTS);

    const fields = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, "v".repeat(500)]));
    const [only] = buildSummaryRequest("x", [doc("a", { aiSynthesis: "s".repeat(5000), structuredFields: fields })]).documents;
    expect(only.synthesis).toHaveLength(1500);
    expect(only.fields).toHaveLength(8);
    expect(only.fields[0].value).toHaveLength(120);
  });
});

describe("parseSummaryRequest", () => {
  const valid = {
    title: "Acquisto casa",
    documents: [{ id: "d1", name: "mutuo.pdf", date: "2026-09-10", synthesis: "Un mutuo.", fields: [{ key: "importo", value: "168000" }] }],
  };

  it("accetta una richiesta ben formata", () => {
    expect(parseSummaryRequest(valid)).toEqual(valid);
  });

  it("rifiuta forme sbagliate e misure fuori limite", () => {
    expect(parseSummaryRequest(null)).toBeNull();
    expect(parseSummaryRequest({ ...valid, title: "" })).toBeNull();
    expect(parseSummaryRequest({ ...valid, documents: [] })).toBeNull();
    expect(parseSummaryRequest({ ...valid, documents: [{ ...valid.documents[0], synthesis: "x".repeat(2000) }] })).toBeNull();
    expect(parseSummaryRequest({ ...valid, documents: [{ ...valid.documents[0], id: 5 }] })).toBeNull();
    expect(parseSummaryRequest({ ...valid, documents: Array(MAX_SUMMARY_DOCUMENTS + 1).fill(valid.documents[0]) })).toBeNull();
  });
});

describe("buildSummaryMessage", () => {
  it("mette il fascicolo e i documenti tra i delimitatori", () => {
    const message = buildSummaryMessage({
      title: "Acquisto casa",
      documents: [{ id: "d1", name: "mutuo.pdf", date: "2026-09-10", synthesis: "Un mutuo.", fields: [{ key: "importo", value: "168000" }] }],
    });
    expect(message).toContain("Fascicolo: Acquisto casa");
    expect(message).toContain("<<<\n1. mutuo.pdf (2026-09-10)\nUn mutuo.\nCampi: importo: 168000\n>>>");
  });
});

describe("riassunto da aggiornare", () => {
  it("conta i documenti letti da Hinthia", () => {
    expect(readableDocumentCount([{ aiSynthesisGeneratedAt: "2026-09-01T00:00:00Z" }, { aiSynthesisGeneratedAt: null }])).toBe(1);
  });

  it("è da aggiornare solo se ora ce ne sono di più di quando fu scritto", () => {
    const summary = { text: "x", generatedAt: "2026-09-01T00:00:00Z", documentCount: 2, readableCount: 3 };
    expect(isSummaryStale(summary, 3)).toBe(false);
    expect(isSummaryStale(summary, 4)).toBe(true);
    // Un riassunto vecchio, senza readableCount, si confronta con i documenti usati.
    expect(isSummaryStale({ text: "x", generatedAt: "2026-09-01T00:00:00Z", documentCount: 2 }, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// La rotta: i permessi si controllano sul database, non fidandosi del client.
// ---------------------------------------------------------------------------------------------------------------

const summarize = vi.fn();
const logAudit = vi.fn();
let db: Record<string, unknown>;
let user: { id: string } | null;

vi.mock("@/lib/ai/claude-dossier-summary", () => ({ summarizeDossierWithClaude: (...args: unknown[]) => summarize(...args) }));
vi.mock("@/lib/audit/log-event", () => ({ logAuditEvent: (...args: unknown[]) => logAudit(...args) }));
vi.mock("@/lib/db/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => {
      const result = { data: db[table], error: null };
      const builder: Record<string, unknown> = {
        select: () => builder,
        in: () => builder,
        eq: () => builder,
        single: async () => result,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    },
  }),
}));

async function post(body: unknown) {
  const { POST } = await import("@/app/api/ai/dossier-summary/route");
  const response = await POST(new Request("http://localhost/api/ai/dossier-summary", { method: "POST", body: JSON.stringify(body) }) as never);
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const REQUEST = {
  title: "Acquisto casa",
  documents: [
    { id: "ok", name: "mutuo.pdf", date: "2026-09-10", synthesis: "Un mutuo.", fields: [] },
    { id: "escluso", name: "privato.pdf", date: "2026-09-11", synthesis: "Cosa privata.", fields: [] },
    { id: "nocat", name: "senza.pdf", date: "2026-09-12", synthesis: "Senza categoria.", fields: [] },
  ],
};

describe("POST /api/ai/dossier-summary", () => {
  beforeEach(() => {
    summarize.mockReset().mockResolvedValue("Un riassunto.");
    logAudit.mockReset();
    user = { id: "u1" };
    process.env.ANTHROPIC_API_KEY = "test-key";
    db = {
      profiles: { ai_master_enabled: true, ai_extraction_consent: true },
      documents: [
        { id: "ok", category_id: "c1", ai_extraction_excluded: false },
        { id: "escluso", category_id: "c1", ai_extraction_excluded: true },
        { id: "nocat", category_id: null, ai_extraction_excluded: false },
      ],
      categories: [{ id: "c1", name: "Casa", ai_extraction_enabled: true, ai_extraction_enabled_until: null }],
    };
  });

  it("manda a Claude solo i documenti permessi e conta gli altri come saltati", async () => {
    const { status, json } = await post(REQUEST);
    expect(status).toBe(200);
    expect(json).toMatchObject({ summary: "Un riassunto.", used: 1, skipped: 2 });
    const sent = summarize.mock.calls[0][1] as { documents: { id: string }[] };
    expect(sent.documents.map((d) => d.id)).toEqual(["ok"]);
    expect(logAudit).toHaveBeenCalledTimes(1);
  });

  it("senza consenso generale non parte nulla", async () => {
    db.profiles = { ai_master_enabled: true, ai_extraction_consent: false };
    expect((await post(REQUEST)).status).toBe(403);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("con la categoria non abilitata non parte nulla", async () => {
    db.categories = [{ id: "c1", name: "Casa", ai_extraction_enabled: false, ai_extraction_enabled_until: null }];
    const { status } = await post(REQUEST);
    expect(status).toBe(403);
    expect(summarize).not.toHaveBeenCalled();
  });

  it("non autenticati e richieste malformate sono respinti", async () => {
    user = null;
    expect((await post(REQUEST)).status).toBe(401);
    user = { id: "u1" };
    expect((await post({ title: "x", documents: [] })).status).toBe(400);
    expect(summarize).not.toHaveBeenCalled();
  });
});
