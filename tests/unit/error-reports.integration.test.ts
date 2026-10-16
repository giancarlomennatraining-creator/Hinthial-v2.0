/**
 * Integration test della raccolta degli errori (migrazione 20261017000002_error_reports.sql) sul database vero: lo stesso
 * errore ripetuto è una riga sola con il conteggio, uno diverso è una riga nuova, e nessun utente può leggere, scrivere
 * o chiamare la funzione. Le righe di prova hanno un messaggio unico e si cancellano alla fine; il riepilogo via email
 * non si prova qui (segnerebbe come inviati anche gli errori veri), ma in error-digest.test.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("raccolta degli errori", () => {
  let admin: SupabaseClient;
  let userId = "";
  let userClient: SupabaseClient;
  let migrated = true;
  const marker = `test-integrazione-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);
    const { error } = await admin.from("error_reports").select("id").limit(1);
    if (error) {
      migrated = false;
      console.warn("[error-reports] migrazione 20261017000002_error_reports.sql non applicata: test saltati");
      return;
    }
    const email = `hinthial-errors-${marker}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password: "Error-Reports-Test-1", email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Utente di test non creato: ${created.error?.message}`);
    userId = created.data.user.id;
    userClient = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    await userClient.auth.signInWithPassword({ email, password: "Error-Reports-Test-1" });
  });

  afterAll(async () => {
    if (!migrated) return;
    await admin.from("error_reports").delete().like("message", `%${marker}%`);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("lo stesso errore ripetuto è una riga sola, con il conteggio; uno diverso è una riga nuova", async (ctx) => {
    if (!migrated) return ctx.skip();
    vi.stubEnv("ERROR_REPORTS_FORCE", "1");
    const { recordError } = await import("@/lib/errors/record");
    const report = { source: "client" as const, kind: "TypeError", message: `Prova ${marker} riga 1`, path: "/archive", digest: null };

    await recordError(report, "Test");
    await recordError({ ...report, message: `Prova ${marker} riga 2` }, "Test"); // stesso errore: cambia solo un numero
    await recordError({ ...report, path: "/capsules" }, "Test");
    vi.unstubAllEnvs();

    const { data } = await admin
      .from("error_reports")
      .select("path, count, notified_at")
      .like("message", `%${marker}%`)
      .order("path");
    expect(data).toEqual([
      { path: "/archive", count: 2, notified_at: null },
      { path: "/capsules", count: 1, notified_at: null },
    ]);
  });

  it("fuori da produzione non registra nulla (gli e2e non riempiono l'email)", async (ctx) => {
    if (!migrated) return ctx.skip();
    const { recordError } = await import("@/lib/errors/record");
    await recordError({ source: "client", kind: "TypeError", message: `Silenzio ${marker}`, path: null, digest: null }, null);
    const { data } = await admin.from("error_reports").select("id").like("message", `Silenzio ${marker}%`);
    expect(data).toEqual([]);
  });

  it("un utente non legge, non scrive e non chiama la funzione", async (ctx) => {
    if (!migrated) return ctx.skip();
    const { data: seen } = await userClient.from("error_reports").select("id").limit(5);
    expect(seen).toEqual([]);
    const inserted = await userClient
      .from("error_reports")
      .insert({ fingerprint: "x", day: "2026-01-01", source: "client", kind: "x", message: `Intruso ${marker}` });
    expect(inserted.error).not.toBeNull();
    const called = await userClient.rpc("record_error_report", {
      p_fingerprint: "x",
      p_source: "client",
      p_kind: "x",
      p_message: `Intruso ${marker}`,
      p_path: null,
      p_digest: null,
      p_user_agent: null,
    });
    expect(called.error).not.toBeNull();
  });
});
