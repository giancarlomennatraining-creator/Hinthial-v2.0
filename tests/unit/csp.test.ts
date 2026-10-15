import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, createNonce } from "@/lib/security/csp";

const BASE = { nonce: "abc123", isDev: false, supabaseUrl: "https://xyz.supabase.co", upgradeInsecureRequests: true };

function directive(csp: string, name: string): string {
  return csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
}

describe("buildContentSecurityPolicy", () => {
  it("lets scripts run only with the request's nonce, never inline or eval in production", () => {
    const scripts = directive(buildContentSecurityPolicy(BASE), "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    // Il motore OCR è WebAssembly: serve compilarlo, non eseguire JavaScript da stringhe.
    expect(scripts).toContain("'wasm-unsafe-eval'");
  });

  it("allows eval only in development, where React needs it", () => {
    expect(directive(buildContentSecurityPolicy({ ...BASE, isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("talks only to itself and to Supabase's origin", () => {
    const csp = buildContentSecurityPolicy({ ...BASE, supabaseUrl: "https://xyz.supabase.co/rest/v1" });
    expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://xyz.supabase.co");
    expect(directive(csp, "img-src")).toContain("https://xyz.supabase.co");
  });

  it("never lets another site frame Hinthial, and forbids plugins", () => {
    const csp = buildContentSecurityPolicy(BASE);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("upgrades insecure requests only when asked (not over plain HTTP on localhost)", () => {
    expect(buildContentSecurityPolicy(BASE)).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ ...BASE, upgradeInsecureRequests: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("still works without a Supabase URL", () => {
    expect(directive(buildContentSecurityPolicy({ ...BASE, supabaseUrl: undefined }), "connect-src")).toBe(
      "connect-src 'self'",
    );
    expect(directive(buildContentSecurityPolicy({ ...BASE, supabaseUrl: "non un url" }), "connect-src")).toBe(
      "connect-src 'self'",
    );
  });
});

describe("createNonce", () => {
  it("is different every time and long enough", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(atob(a)).toHaveLength(16);
  });
});
