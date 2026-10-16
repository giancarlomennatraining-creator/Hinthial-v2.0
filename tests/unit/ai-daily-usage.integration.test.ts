/**
 * Integration test del tetto giornaliero a Claude (migrazione 20261017000000_ai_daily_usage.sql), sul database vero:
 * la funzione conta e si ferma al tetto, anche con richieste contemporanee; ognuno vede solo la propria riga e nessuno
 * può scriverla a mano. Si salta da solo senza le variabili d'ambiente, o se la migrazione non è ancora applicata.
 * Solo account usa e getta, cancellati alla fine.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { romeDay } from "@/lib/ai/daily-quota";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("tetto giornaliero a Claude", () => {
  let admin: SupabaseClient;
  const users: { id: string; client: SupabaseClient }[] = [];
  let migrated = true;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createSignedInUser(label: string) {
    const email = `hinthial-ai-quota-${label}-${suffix}@example.com`;
    const password = "Ai-Quota-Test-1";
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Utente di test non creato: ${created.error?.message}`);
    const client = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(`Accesso di test non riuscito: ${signedIn.error.message}`);
    users.push({ id: created.data.user.id, client });
    return { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);
    const probe = await createSignedInUser("probe");
    const { error } = await probe.client.rpc("consume_ai_call", { daily_limit: 1 });
    if (error?.code === "PGRST202") {
      migrated = false;
      console.warn("[ai-daily-usage] migrazione 20261017000000_ai_daily_usage.sql non applicata: test saltati");
    }
  });

  afterAll(async () => {
    for (const user of users) await admin.auth.admin.deleteUser(user.id);
  });

  it("conta una chiamata alla volta e si ferma al tetto senza contare oltre", async (ctx) => {
    if (!migrated) return ctx.skip();
    const { id, client } = await createSignedInUser("seq");

    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { data, error } = await client.rpc("consume_ai_call", { daily_limit: 3 });
      expect(error).toBeNull();
      results.push(data as number);
    }
    expect(results).toEqual([1, 2, 3, -1, -1]);

    const { data: row } = await client.from("ai_daily_usage").select("user_id, day, calls").single();
    expect(row).toEqual({ user_id: id, day: romeDay(), calls: 3 });
  });

  it("con tante richieste contemporanee ne passano esattamente quante il tetto", async (ctx) => {
    if (!migrated) return ctx.skip();
    const { client } = await createSignedInUser("par");

    const results = await Promise.all(
      Array.from({ length: 12 }, () => client.rpc("consume_ai_call", { daily_limit: 5 })),
    );
    const allowed = results.filter((r) => typeof r.data === "number" && r.data > 0).length;
    expect(results.every((r) => r.error === null)).toBe(true);
    expect(allowed).toBe(5);
  });

  it("ognuno vede solo la propria riga, e nessuno può scriverla a mano", async (ctx) => {
    if (!migrated) return ctx.skip();
    const a = await createSignedInUser("a");
    const b = await createSignedInUser("b");
    await a.client.rpc("consume_ai_call", { daily_limit: 10 });

    const { data: seenByB } = await b.client.from("ai_daily_usage").select("user_id").eq("user_id", a.id);
    expect(seenByB).toEqual([]);

    // Azzerare il proprio contatore o crearne uno: niente policy di scrittura, quindi niente cambia.
    await a.client.from("ai_daily_usage").update({ calls: 0 }).eq("user_id", a.id);
    const inserted = await b.client.from("ai_daily_usage").insert({ user_id: b.id, day: romeDay(), calls: 0 });
    expect(inserted.error).not.toBeNull();
    const { data: stillA } = await a.client.from("ai_daily_usage").select("calls").single();
    expect(stillA?.calls).toBe(1);
  });
});
