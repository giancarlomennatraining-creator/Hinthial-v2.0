import { describe, expect, it } from "vitest";
import {
  fingerprintOf,
  isNoise,
  normalizePath,
  parseClientReport,
  sanitizeKind,
  sanitizeMessage,
} from "@/lib/errors/sanitize";
import { errorDigestEmail, type ErrorDigestRow } from "@/lib/email/templates";

describe("sanitizeMessage", () => {
  it("takes out emails, ids, quoted text and long numbers", () => {
    const message = sanitizeMessage(
      'Impossibile caricare "Passaporto Marta.pdf" per marta@example.com (doc 3f2b1c9a-1234-4abc-9def-0123456789ab, tel 3331234567)',
    );
    expect(message).toBe('Impossibile caricare "…" per [email] (doc :id, tel #)');
  });

  it("is short and on one line", () => {
    expect(sanitizeMessage(`a\n\n b ${"x".repeat(1000)}`)).toHaveLength(300);
    expect(sanitizeMessage("a\n\n b")).toBe("a b");
  });
});

describe("normalizePath", () => {
  it("keeps only the path: never the query or the fragment, where a shared link keeps its key", () => {
    expect(normalizePath("https://hinthial.vercel.app/c/3f2b1c9a-1234-4abc-9def-0123456789ab?x=1#chiave-segreta")).toBe(
      "/c/:id",
    );
    expect(normalizePath("/archive?view=table")).toBe("/archive");
    expect(normalizePath(null)).toBeNull();
  });
});

describe("sanitizeKind", () => {
  it("keeps a short readable name", () => {
    expect(sanitizeKind("TypeError")).toBe("TypeError");
    expect(sanitizeKind("csp:script-src")).toBe("csp:script-src");
    expect(sanitizeKind("<b>x</b>")).toBe("bxb");
    expect(sanitizeKind("")).toBe("Error");
  });
});

describe("fingerprintOf", () => {
  it("groups the same error even when only a number changes, and keeps different pages apart", async () => {
    const base = { source: "client" as const, kind: "TypeError", path: "/archive", digest: null };
    const a = await fingerprintOf({ ...base, message: "Riga 12 non valida" });
    const b = await fingerprintOf({ ...base, message: "Riga 345 non valida" });
    const c = await fingerprintOf({ ...base, path: "/capsules", message: "Riga 12 non valida" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isNoise", () => {
  it("ignores browser extensions and messages that say nothing about Hinthial", () => {
    expect(isNoise("boom", "chrome-extension://abc/x.js")).toBe(true);
    expect(isNoise("Script error.")).toBe(true);
    expect(isNoise("ResizeObserver loop completed with undelivered notifications.")).toBe(true);
    expect(isNoise("Cannot read properties of undefined")).toBe(false);
  });
});

describe("parseClientReport", () => {
  it("accepts a browser error and cleans it", () => {
    expect(
      parseClientReport({ source: "client", kind: "TypeError", message: "per marta@example.com", path: "/archive?x=1", digest: "abc 123" }),
    ).toEqual({ source: "client", kind: "TypeError", message: "per [email]", path: "/archive", digest: "abc123" });
  });

  it("refuses anything that is not an error report: a server source, an empty message, noise", () => {
    expect(parseClientReport(null)).toBeNull();
    expect(parseClientReport({ source: "server", message: "x" })).toBeNull();
    expect(parseClientReport({ source: "client", message: "  " })).toBeNull();
    expect(parseClientReport({ source: "client", message: "Script error." })).toBeNull();
  });
});

describe("errorDigestEmail", () => {
  const row = (overrides: Partial<ErrorDigestRow> = {}): ErrorDigestRow => ({
    source: "client",
    kind: "TypeError",
    message: "Qualcosa è andato storto",
    path: "/archive",
    digest: null,
    count: 1,
    first_seen: "2026-10-16T08:00:00Z",
    last_seen: "2026-10-16T09:30:00Z",
    ...overrides,
  });

  it("counts groups in the subject and occurrences in the text", () => {
    const { subject, html } = errorDigestEmail([row({ count: 3 }), row({ source: "server", kind: "Error (route)" })]);
    expect(subject).toBe("Hinthial: 2 errori nuovi in produzione");
    expect(html).toContain("sono comparsi 2 errori diversi, 4 volte in tutto");
    expect(html).toContain("Browser · TypeError</strong> — 3 volte");
    expect(html).toContain("Server · Error (route)");
  });

  it("escapes whatever the error says", () => {
    const { subject, html } = errorDigestEmail([row({ message: '<img src=x onerror="alert(1)">' })]);
    expect(subject).toBe("Hinthial: 1 errore nuovo in produzione");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
