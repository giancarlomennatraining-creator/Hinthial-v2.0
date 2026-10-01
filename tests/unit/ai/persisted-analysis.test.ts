import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalysisAbortedError,
  analyzeDocumentWithClaude,
  extractedFieldsFrom,
  inspectSavedAnalysis,
  resetAnalysisSession,
} from "@/domain/ai/analyze-document";
import {
  parsePersistedAnalysis,
  statusOf,
  type AnalysisStatus,
  type PersistedContentAnalysis,
} from "@/domain/ai/analysis/persisted";
import type { Category } from "@/domain/categories/types";
import type { ContentSegment } from "@/domain/extraction/types";
import { contentFingerprint, generateSymmetricKey } from "@/lib/crypto";

const CATEGORIES: Category[] = [
  { id: "cat-assicurazioni", name: "Assicurazioni", icon: "🛡️", aiExtractionEnabled: true, aiExtractionEnabledUntil: null },
];

const LONG_PAGE = "Clausola di prova. ".repeat(500);
const SEGMENTS: ContentSegment[] = [
  { id: "p1", kind: "page", index: 1, text: `Numero polizza: IT-4471-2027\n${LONG_PAGE}` },
  { id: "p2", kind: "page", index: 2, text: `${LONG_PAGE}\nValida fino al 3 giugno 2027.` },
];
const DOC = { id: "doc-1", extractedText: "testo" };

function blockReply(result: Record<string, unknown>) {
  return {
    ok: true,
    json: async () => ({
      result: { documentType: "polizza", expiry: [], issuer: [], category: null, fields: [], synthesis: null, ...result },
    }),
  };
}

const FIRST = () => blockReply({ synthesis: "Prima parte." });
const SECOND = () =>
  blockReply({
    documentType: null,
    expiry: [{ value: "2027-06-03", segmentId: "p2", quote: "Valida fino al 3 giugno 2027." }],
    synthesis: "Seconda parte.",
  });
const MERGE = () => ({ ok: true, json: async () => ({ synthesis: "Una polizza valida fino a giugno 2027." }) });
const FAIL = () => ({ ok: false, json: async () => ({ error: "boom" }) });

function recorder(saved: PersistedContentAnalysis | null = null) {
  const saves: { analysis: PersistedContentAnalysis; status: AnalysisStatus }[] = [];
  return {
    saves,
    make: (masterKey: CryptoKey) => ({
      masterKey,
      saved,
      save: async (analysis: PersistedContentAnalysis, status: AnalysisStatus) => {
        // Una copia: lo stato in memoria continua a cambiare dopo il salvataggio.
        saves.push({ analysis: structuredClone(analysis), status });
      },
    }),
  };
}

describe("contentFingerprint", () => {
  it("è deterministico, dipende dal contenuto e dalla chiave, e non lascia leggere il testo", async () => {
    const key = await generateSymmetricKey();
    const other = await generateSymmetricKey();
    const a = await contentFingerprint(key, ["v1", "testo"]);
    expect(await contentFingerprint(key, ["v1", "testo"])).toBe(a);
    expect(await contentFingerprint(key, ["v1", "testo diverso"])).not.toBe(a);
    expect(await contentFingerprint(key, ["v2", "testo"])).not.toBe(a);
    expect(await contentFingerprint(other, ["v1", "testo"])).not.toBe(a);
    expect(a).not.toContain("testo");
  });

  it("le parti non si confondono tra loro", async () => {
    const key = await generateSymmetricKey();
    expect(await contentFingerprint(key, ["ab", "c"])).not.toBe(await contentFingerprint(key, ["a", "bc"]));
  });
});

describe("parsePersistedAnalysis e statusOf", () => {
  const valid = (): PersistedContentAnalysis => ({
    v: 1,
    fingerprint: "fp",
    schemaVersion: 1,
    pipelineVersion: 1,
    models: { block: "m", merge: "m" },
    documentType: "polizza",
    blocksTotal: 2,
    blocksTotalBeforeCap: 2,
    truncated: false,
    blocks: [
      {
        expiry: [{ value: "2027-06-03", source: "q", provenance: { segmentId: "p2", page: 2 } }],
        issuer: [],
        category: null,
        fields: [{ key: "k", label: "K", value: "v", source: "q", provenance: { segmentId: "p1", page: null } }],
        synthesis: "s",
      },
    ],
    synthesis: null,
    mergeDone: false,
    updatedAt: "2026-10-01T10:00:00Z",
  });

  it("rilegge ciò che è stato scritto, anche dopo un giro per JSON", () => {
    const analysis = valid();
    expect(parsePersistedAnalysis(JSON.parse(JSON.stringify(analysis)))).toEqual(analysis);
  });

  it("un blocco cifrato che non si capisce vale 'nessuna lettura', non un errore", () => {
    expect(parsePersistedAnalysis(null)).toBeNull();
    expect(parsePersistedAnalysis("x")).toBeNull();
    expect(parsePersistedAnalysis({ ...valid(), v: 2 })).toBeNull();
    expect(parsePersistedAnalysis({ ...valid(), blocks: [{ expiry: "no" }] })).toBeNull();
    expect(parsePersistedAnalysis({ ...valid(), documentType: "inventato" })).toBeNull();
    expect(parsePersistedAnalysis({ ...valid(), mergeDone: "sì" })).toBeNull();
  });

  it("lo stato dice a che punto è", () => {
    const analysis = valid();
    expect(statusOf(analysis)).toBe("pending");
    const read = { ...analysis, blocksTotal: 1 };
    expect(statusOf(read)).toBe("partial");
    expect(statusOf({ ...read, mergeDone: true })).toBe("completed");
    expect(statusOf({ ...read, mergeDone: true, truncated: true })).toBe("partial");
  });
});

describe("lettura salvata e ripresa", () => {
  beforeEach(() => {
    resetAnalysisSession();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("salva dopo ogni blocco e a fine lettura, con lo stato giusto", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE()));

    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: rec.make(key) });

    expect(rec.saves.map((s) => [s.analysis.blocks.length, s.status])).toEqual([
      [1, "pending"],
      [2, "pending"],
      [2, "completed"],
    ]);
    const last = rec.saves.at(-1)!.analysis;
    expect(last.synthesis).toBe("Una polizza valida fino a giugno 2027.");
    expect(last.mergeDone).toBe(true);
    expect(last.fingerprint).not.toBe("");
  });

  it("dopo un errore a metà, i blocchi già letti restano salvati come 'failed' e la ripresa parte dal primo mancante", async () => {
    const key = await generateSymmetricKey();
    const first = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(FAIL()));
    await expect(
      analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: first.make(key) }),
    ).rejects.toThrow("boom");
    const failed = first.saves.at(-1)!;
    expect(failed.status).toBe("failed");
    expect(failed.analysis.blocks).toHaveLength(1);

    expect(await inspectSavedAnalysis({ extractedText: DOC.extractedText, contentAnalysis: failed.analysis }, key, { segments: SEGMENTS })).toEqual({
      kind: "interrupted",
      done: 1,
      total: 2,
    });

    resetAnalysisSession();
    const second = recorder(failed.analysis);
    const fetchSpy = vi.fn().mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE());
    vi.stubGlobal("fetch", fetchSpy);
    const fields = await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: second.make(key) });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({ mode: "block", documentType: "polizza" });
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).block.text).toContain("Valida fino al 3 giugno 2027.");
    expect(fields.expiry[0].provenance).toEqual({ segmentId: "p2", page: 2 });
    expect(fields.coverage).toEqual({ blocksAnalyzed: 2, blocksTotal: 2, truncated: false });
    expect(second.saves.at(-1)!.status).toBe("completed");
  });

  it("una lettura già completa non manda nulla e non spende richieste", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE()));
    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: rec.make(key) });
    const saved = rec.saves.at(-1)!.analysis;

    expect(await inspectSavedAnalysis({ extractedText: DOC.extractedText, contentAnalysis: saved }, key, { segments: SEGMENTS })).toEqual({
      kind: "complete",
    });

    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const again = recorder(saved);
    const fields = await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: again.make(key) });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(again.saves).toHaveLength(0);
    expect(fields.synthesis).toBe("Una polizza valida fino a giugno 2027.");
  });

  it("se la fusione fallisce resta 'partial' e il retry rifà solo la fusione", async () => {
    const key = await generateSymmetricKey();
    const first = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(FAIL()));
    const fields = await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: first.make(key) });
    expect(fields.synthesis).toBe("Prima parte. Seconda parte.");
    const partial = first.saves.at(-1)!;
    expect(partial.status).toBe("partial");
    expect(partial.analysis.mergeDone).toBe(false);

    expect(await inspectSavedAnalysis({ extractedText: DOC.extractedText, contentAnalysis: partial.analysis }, key, { segments: SEGMENTS })).toEqual({
      kind: "merge-pending",
    });

    resetAnalysisSession();
    const fetchSpy = vi.fn().mockResolvedValueOnce(MERGE());
    vi.stubGlobal("fetch", fetchSpy);
    const retry = recorder(partial.analysis);
    const done = await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: retry.make(key) });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).mode).toBe("merge");
    expect(done.synthesis).toBe("Una polizza valida fino a giugno 2027.");
    expect(retry.saves.at(-1)!.status).toBe("completed");
  });

  it("interrompere salva ciò che è già stato letto come 'pending' e lancia AnalysisAbortedError", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    const controller = new AbortController();
    const fetchSpy = vi.fn().mockImplementationOnce(async () => {
      controller.abort();
      return FIRST();
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      analyzeDocumentWithClaude(DOC, CATEGORIES, "once", {
        segments: SEGMENTS,
        persistence: rec.make(key),
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const last = rec.saves.at(-1)!;
    expect(last.status).toBe("pending");
    expect(last.analysis.blocks).toHaveLength(1);
  });

  it("'Rileggi da capo' (force) ignora la lettura salvata e ripartisce dal primo blocco", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE()));
    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: rec.make(key) });
    const saved = rec.saves.at(-1)!.analysis;

    resetAnalysisSession();
    const fetchSpy = vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE());
    vi.stubGlobal("fetch", fetchSpy);
    const again = recorder(saved);
    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: again.make(key), force: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).documentType).toBeNull();
  });

  it("se il testo cambia, la lettura salvata è 'stale' e si riparte da capo", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE()));
    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", { segments: SEGMENTS, persistence: rec.make(key) });
    const saved = rec.saves.at(-1)!.analysis;

    const changed: ContentSegment[] = [{ ...SEGMENTS[0], text: `${SEGMENTS[0].text} modificato` }, SEGMENTS[1]];
    expect(await inspectSavedAnalysis({ extractedText: DOC.extractedText, contentAnalysis: saved }, key, { segments: changed })).toEqual({
      kind: "stale",
    });
    expect(await inspectSavedAnalysis({ extractedText: DOC.extractedText, contentAnalysis: null }, key, { segments: changed })).toEqual({
      kind: "none",
    });

    resetAnalysisSession();
    const fetchSpy = vi.fn().mockResolvedValueOnce(FIRST()).mockResolvedValueOnce(SECOND()).mockResolvedValueOnce(MERGE());
    vi.stubGlobal("fetch", fetchSpy);
    await analyzeDocumentWithClaude(DOC, CATEGORIES, "once", {
      segments: changed,
      persistence: recorder(saved).make(key),
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("extractedFieldsFrom scarta una categoria eliminata dopo la lettura", async () => {
    const key = await generateSymmetricKey();
    const rec = recorder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        blockReply({ category: { id: "cat-assicurazioni", segmentId: "s1", quote: "Numero polizza" }, synthesis: "Breve." }),
      ),
    );
    await analyzeDocumentWithClaude(
      { id: "doc-1", extractedText: "Numero polizza: IT-4471-2027" },
      CATEGORIES,
      "once",
      { persistence: rec.make(key) },
    );
    const saved = rec.saves.at(-1)!.analysis;
    expect(extractedFieldsFrom(saved, CATEGORIES).category?.value).toBe("cat-assicurazioni");
    expect(extractedFieldsFrom(saved, []).category).toBeNull();
  });
});
