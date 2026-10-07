import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildManifest,
  expiresAtFor,
  fragmentFromHash,
  fragmentToKeyBytes,
  isShareId,
  keyToFragment,
  mailtoUrl,
  MAX_SHARE_BYTES,
  MAX_SHARE_DOCUMENTS,
  parseManifest,
  shareStatus,
  shareUrl,
  summarizeAccesses,
  validateShareSelection,
} from "@/domain/dossiers/sharing";

const SHARE_ID = "11111111-2222-4333-8444-555555555555";
const DOC_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("la chiave nel link", () => {
  it("fa il giro tra byte e frammento, senza simboli da indirizzo", () => {
    const raw = new Uint8Array(32).map((_, i) => (i * 37 + 250) % 256);
    const fragment = keyToFragment(raw);
    expect(fragment).toHaveLength(43);
    expect(fragment).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(fragmentToKeyBytes(fragment)!)).toEqual(Array.from(raw));
  });

  it("rifiuta un frammento mancante, troncato o di altra lunghezza", () => {
    expect(fragmentToKeyBytes("")).toBeNull();
    expect(fragmentToKeyBytes("abc")).toBeNull();
    expect(fragmentToKeyBytes("a".repeat(44))).toBeNull();
    expect(fragmentToKeyBytes("!".repeat(43))).toBeNull();
  });

  it("compone il link e rilegge il frammento da location.hash", () => {
    expect(shareUrl("https://hinthial.vercel.app", SHARE_ID, "KEY")).toBe(`https://hinthial.vercel.app/c/${SHARE_ID}#KEY`);
    expect(fragmentFromHash("#KEY")).toBe("KEY");
    expect(fragmentFromHash("")).toBe("");
  });

  it("riconosce solo identificativi del tipo giusto", () => {
    expect(isShareId(SHARE_ID)).toBe(true);
    expect(isShareId("../../etc/passwd")).toBe(false);
    expect(isShareId(`${SHARE_ID}/x`)).toBe(false);
  });
});

describe("l'indice cifrato", () => {
  const manifest = buildManifest({
    title: "Acquisto casa",
    description: "Via Roma 12",
    sharedBy: "Ada Lovelace",
    sharedAt: "2026-10-07T10:00:00Z",
    phase: { names: ["Mutuo", "Rogito"], current: 1 },
    summary: "Un mutuo.",
    documents: [{ id: DOC_ID, name: "mutuo.pdf", mimeType: "application/pdf", size: 1000, createdAt: "2026-09-01T00:00:00Z" }],
  });

  it("fa il giro con JSON", () => {
    expect(parseManifest(JSON.stringify(manifest))).toEqual(manifest);
  });

  it("scarta un indice di forma inattesa", () => {
    expect(parseManifest("non json")).toBeNull();
    expect(parseManifest(JSON.stringify({ ...manifest, v: 2 }))).toBeNull();
    expect(parseManifest(JSON.stringify({ ...manifest, documents: [{ id: 1 }] }))).toBeNull();
    expect(parseManifest("null")).toBeNull();
  });

  it("un riassunto vuoto o una fase guasta non rompono l'indice", () => {
    const parsed = parseManifest(JSON.stringify({ ...manifest, summary: "  ", phase: { names: "x" } }));
    expect(parsed?.summary).toBeNull();
    expect(parsed?.phase).toBeNull();
  });
});

describe("scelta, durata, stato", () => {
  it("chiede almeno un documento e rispetta i limiti", () => {
    expect(validateShareSelection([])).toMatch(/almeno un documento/);
    expect(validateShareSelection(Array(MAX_SHARE_DOCUMENTS + 1).fill({ size: 1 }))).toMatch(/al massimo/);
    expect(validateShareSelection([{ size: MAX_SHARE_BYTES + 1 }])).toMatch(/pesano troppo/);
    expect(validateShareSelection([{ size: 1000 }])).toBeNull();
  });

  it("calcola la scadenza dalla durata scelta", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(expiresAtFor("24h", now)).toBe("2026-10-08T10:00:00.000Z");
    expect(expiresAtFor("7d", now)).toBe("2026-10-14T10:00:00.000Z");
  });

  it("distingue attivo, scaduto e revocato (la revoca vince)", () => {
    const now = new Date("2026-10-07T10:00:00Z");
    expect(shareStatus({ expiresAt: "2026-10-08T00:00:00Z", revokedAt: null }, now)).toBe("active");
    expect(shareStatus({ expiresAt: "2026-10-07T09:00:00Z", revokedAt: null }, now)).toBe("expired");
    expect(shareStatus({ expiresAt: "2026-10-08T00:00:00Z", revokedAt: "2026-10-07T09:00:00Z" }, now)).toBe("revoked");
  });
});

describe("accessi e email", () => {
  it("riassume aperture, documenti diversi visti e ultimo accesso", () => {
    const summary = summarizeAccesses([
      { kind: "open", documentId: null, accessedAt: "2026-10-07T10:00:00Z" },
      { kind: "document", documentId: "a", accessedAt: "2026-10-07T10:01:00Z" },
      { kind: "document", documentId: "a", accessedAt: "2026-10-07T10:02:00Z" },
      { kind: "document", documentId: "b", accessedAt: "2026-10-07T10:03:00Z" },
      { kind: "open", documentId: null, accessedAt: "2026-10-07T09:00:00Z" },
    ]);
    expect(summary).toEqual({ opens: 2, documentsSeen: 2, lastAt: "2026-10-07T10:03:00Z" });
    expect(summarizeAccesses([])).toEqual({ opens: 0, documentsSeen: 0, lastAt: null });
  });

  it("scrive un'email con il link intero, anche con il cancelletto", () => {
    const url = mailtoUrl({ label: "Notaio Rossi", title: "Acquisto casa", url: `https://x.it/c/${SHARE_ID}#CHIAVE`, expiresAt: "2026-10-14T10:00:00Z" });
    expect(url.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(url)).toContain(`https://x.it/c/${SHARE_ID}#CHIAVE`);
    expect(decodeURIComponent(url)).toContain("Buongiorno Notaio Rossi,");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Le pagine pubbliche: l'unico controllo è "attivo, non scaduto, non revocato".
// ---------------------------------------------------------------------------------------------------------------

let shareRow: Record<string, unknown> | null;
let storageObject: string | null;
const inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/db/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === "dossier_shares" ? shareRow : null, error: null }) }),
      }),
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        download: async () => (storageObject === null ? { data: null, error: { message: "not found" } } : { data: new Blob([storageObject]), error: null }),
      }),
    },
  }),
}));

function activeRow(over: Record<string, unknown> = {}) {
  return {
    id: SHARE_ID,
    owner_id: "owner-1",
    encrypted_manifest: "MANIFEST",
    allow_download: true,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    revoked_at: null,
    files_purged_at: null,
    ...over,
  };
}

async function getManifest(id: string) {
  const { GET } = await import("@/app/api/shares/[id]/route");
  const response = await GET(new Request("http://localhost/x") as never, { params: Promise.resolve({ id }) });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function getDocument(id: string, documentId: string) {
  const { GET } = await import("@/app/api/shares/[id]/documents/[documentId]/route");
  const response = await GET(new Request("http://localhost/x") as never, { params: Promise.resolve({ id, documentId }) });
  return { status: response.status, text: await response.text() };
}

describe("GET /api/shares/[id]", () => {
  beforeEach(() => {
    shareRow = activeRow();
    storageObject = "ENVELOPE";
    inserted.length = 0;
  });

  it("consegna l'indice cifrato di un link attivo e registra l'accesso", async () => {
    const { status, json } = await getManifest(SHARE_ID);
    expect(status).toBe(200);
    expect(json).toMatchObject({ encryptedManifest: "MANIFEST", allowDownload: true });
    expect(inserted).toEqual([{ share_id: SHARE_ID, owner_id: "owner-1", kind: "open", document_id: null }]);
  });

  it("risponde allo stesso modo a link sbagliato, scaduto, revocato o ripulito", async () => {
    const unavailable = [
      await getManifest("non-un-uuid"),
      (shareRow = null, await getManifest(SHARE_ID)),
      (shareRow = activeRow({ expires_at: new Date(Date.now() - 1000).toISOString() }), await getManifest(SHARE_ID)),
      (shareRow = activeRow({ revoked_at: new Date().toISOString() }), await getManifest(SHARE_ID)),
      (shareRow = activeRow({ files_purged_at: new Date().toISOString() }), await getManifest(SHARE_ID)),
    ];
    for (const result of unavailable) {
      expect(result.status).toBe(404);
      expect(result.json).toEqual(unavailable[0].json);
    }
    expect(inserted).toEqual([]);
  });
});

describe("GET /api/shares/[id]/documents/[documentId]", () => {
  beforeEach(() => {
    shareRow = activeRow();
    storageObject = "ENVELOPE";
    inserted.length = 0;
  });

  it("consegna la copia cifrata e registra l'accesso al documento", async () => {
    const { status, text } = await getDocument(SHARE_ID, DOC_ID);
    expect(status).toBe(200);
    expect(text).toBe("ENVELOPE");
    expect(inserted).toEqual([{ share_id: SHARE_ID, owner_id: "owner-1", kind: "document", document_id: DOC_ID }]);
  });

  it("non consegna nulla se il link è revocato, la copia non c'è o gli id non sono validi", async () => {
    shareRow = activeRow({ revoked_at: new Date().toISOString() });
    expect((await getDocument(SHARE_ID, DOC_ID)).status).toBe(404);
    shareRow = activeRow();
    storageObject = null;
    expect((await getDocument(SHARE_ID, DOC_ID)).status).toBe(404);
    expect((await getDocument(SHARE_ID, "../x")).status).toBe(404);
    expect(inserted).toEqual([]);
  });
});
