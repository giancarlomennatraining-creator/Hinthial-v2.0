import { describe, expect, it, vi } from "vitest";
import {
  decryptSegments,
  encryptSegments,
  loadDocumentSegments,
  saveDocumentSegments,
  segmentsMatchText,
} from "@/domain/documents/segments";
import { deleteDocument } from "@/domain/documents/repository";
import { analyzeDocumentWithClaude, inspectSavedAnalysis, resetAnalysisSession } from "@/domain/ai/analyze-document";
import type { PersistedContentAnalysis } from "@/domain/ai/analysis/persisted";
import { documentSegmentsPath, documentStoragePath, documentThumbnailPath } from "@/lib/storage/documents-bucket";
import { normalizeExtractedText, type ContentSegment } from "@/domain/extraction/types";
import { generateSymmetricKey } from "@/lib/crypto";

vi.mock("@/lib/audit/log-event", () => ({ logAuditEvent: vi.fn(async () => {}) }));

const SEGMENTS: ContentSegment[] = [
  { id: "p1", kind: "page", index: 1, text: "Numero polizza: IT-4471-2027" },
  { id: "p3", kind: "page", index: 3, text: "Valida fino al 3 giugno 2027." },
];
const TEXT = normalizeExtractedText(SEGMENTS.map((s) => s.text).join("\n\n"))!;

/** Uno Storage in memoria con la sola superficie che usa il codice sotto test. */
function fakeSupabase() {
  const objects = new Map<string, string>();
  const removed: string[] = [];
  const supabase = {
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => {
          objects.set(path, await blob.text());
          return { error: null };
        },
        download: async (path: string) => {
          const value = objects.get(path);
          return value === undefined ? { data: null, error: { message: "not found" } } : { data: new Blob([value]), error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) {
            removed.push(path);
            objects.delete(path);
          }
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { encrypted_filename: "cifrato" }, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  return { supabase: supabase as never, objects, removed };
}

describe("segmenti per pagina", () => {
  it("il percorso si deriva da quello del file, accanto alla miniatura", () => {
    const path = documentStoragePath("owner", "doc");
    expect(documentSegmentsPath(path)).toBe("owner/doc-segments.json");
    expect(documentSegmentsPath(path)).not.toBe(documentThumbnailPath(path));
  });

  it("fa il giro cifrato e il server non vede il testo", async () => {
    const key = await generateSymmetricKey();
    const { supabase, objects } = fakeSupabase();
    const path = documentStoragePath("owner", "doc");

    expect(await saveDocumentSegments(supabase, key, path, SEGMENTS)).toBe(true);
    const stored = objects.get(documentSegmentsPath(path))!;
    expect(stored).not.toContain("polizza");
    expect(stored).not.toContain("giugno");

    expect(await loadDocumentSegments(supabase, key, { storagePath: path, extractedText: TEXT })).toEqual(SEGMENTS);
  });

  it("non vale se il testo di adesso è un altro, o con un'altra chiave", async () => {
    const key = await generateSymmetricKey();
    const serialized = await encryptSegments(key, SEGMENTS);

    expect(await decryptSegments(key, serialized, "Un altro testo")).toBeNull();
    expect(await decryptSegments(await generateSymmetricKey(), serialized, TEXT)).toBeNull();
    expect(await decryptSegments(key, "non è una busta", TEXT)).toBeNull();
  });

  it("senza blob (documento letto prima) restituisce null", async () => {
    const key = await generateSymmetricKey();
    const { supabase } = fakeSupabase();
    expect(await loadDocumentSegments(supabase, key, { storagePath: "owner/x.json", extractedText: TEXT })).toBeNull();
    expect(await loadDocumentSegments(supabase, key, { storagePath: "owner/x.json", extractedText: "" })).toBeNull();
  });

  it("segmentsMatchText rifiuta elenchi vuoti", () => {
    expect(segmentsMatchText([], "")).toBe(false);
    expect(segmentsMatchText(SEGMENTS, TEXT)).toBe(true);
  });

  it("eliminare il documento elimina anche il blob dei segmenti", async () => {
    const key = await generateSymmetricKey();
    const { supabase, objects, removed } = fakeSupabase();
    const path = documentStoragePath("owner", "doc");
    await saveDocumentSegments(supabase, key, path, SEGMENTS);

    await deleteDocument(supabase, "owner", { id: "doc", storagePath: path, hasThumbnail: false });

    expect(removed).toContain(documentSegmentsPath(path));
    expect(objects.has(documentSegmentsPath(path))).toBe(false);
  });

  it("una lettura fatta sulle sezioni diventa da rifare quando arrivano le pagine", async () => {
    resetAnalysisSession();
    const key = await generateSymmetricKey();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          String(url).includes("merge")
            ? { synthesis: "Sintesi." }
            : { result: { documentType: "polizza", expiry: [], issuer: [], category: null, fields: [], synthesis: "Parte." } },
      })),
    );
    const saves: PersistedContentAnalysis[] = [];
    await analyzeDocumentWithClaude({ id: "d", extractedText: TEXT }, [], "once", {
      persistence: {
        masterKey: key,
        saved: null,
        save: async (analysis) => {
          saves.push(structuredClone(analysis));
        },
      },
    });
    vi.unstubAllGlobals();
    const saved = saves[saves.length - 1];

    const doc = { extractedText: TEXT, contentAnalysis: saved };
    expect((await inspectSavedAnalysis(doc, key)).kind).toBe("complete");
    // Con le pagine il testo dei blocchi cambia (marcatori p1/p3 invece di s1): la lettura vecchia non vale più.
    expect((await inspectSavedAnalysis(doc, key, { segments: SEGMENTS })).kind).toBe("stale");
  });
});
