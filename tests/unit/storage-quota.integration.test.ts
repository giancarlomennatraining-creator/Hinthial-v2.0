/**
 * Integration test dello spazio per utente (migrazione 20261017000001_storage_quota.sql), sul database e sullo storage
 * veri: il conteggio vede solo i propri file, e oltre il tetto lo storage rifiuta il caricamento anche scavalcando
 * l'app, ma non la miniatura di un documento già caricato. Per non caricare 2 GB, l'utente di prova riceve un tetto
 * minuscolo con un'eccezione in storage_quota_overrides. Si salta da solo senza variabili d'ambiente o senza
 * migrazione. Solo account usa e getta, cancellati alla fine con i loro file.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);
const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const BUCKET = "encrypted-documents";

describe.runIf(canRun)("spazio per utente", () => {
  let admin: SupabaseClient;
  const users: { id: string; client: SupabaseClient }[] = [];
  let migrated = true;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createSignedInUser(label: string) {
    const email = `hinthial-storage-quota-${label}-${suffix}@example.com`;
    const password = "Storage-Quota-Test-1";
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error(`Utente di test non creato: ${created.error?.message}`);
    const client = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(`Accesso di test non riuscito: ${signedIn.error.message}`);
    const user = { id: created.data.user.id, client };
    users.push(user);
    return user;
  }

  // Byte veri, non un Blob: nell'ambiente dei test (jsdom) un Blob non arriva intero allo storage.
  const blob = (bytes: number) => new Uint8Array(bytes);

  async function usageOf(client: SupabaseClient) {
    const { data, error } = await client.rpc("my_storage_usage");
    expect(error).toBeNull();
    const row = (data as { used_bytes: number; quota_bytes: number }[])[0];
    return { used: Number(row.used_bytes), quota: Number(row.quota_bytes) };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);
    const probe = await createSignedInUser("probe");
    const { error } = await probe.client.rpc("my_storage_usage");
    if (error?.code === "PGRST202") {
      migrated = false;
      console.warn("[storage-quota] migrazione 20261017000001_storage_quota.sql non applicata: test saltati");
    }
  });

  afterAll(async () => {
    for (const user of users) {
      const { data } = await admin.storage.from(BUCKET).list(user.id);
      if (data?.length) await admin.storage.from(BUCKET).remove(data.map((f) => `${user.id}/${f.name}`));
      await admin.auth.admin.deleteUser(user.id);
    }
  });

  it("conta solo i propri file, con il tetto predefinito di 2 GiB", async (ctx) => {
    if (!migrated) return ctx.skip();
    const a = await createSignedInUser("a");
    const b = await createSignedInUser("b");

    const uploaded = await a.client.storage.from(BUCKET).upload(`${a.id}/doc-1.json`, blob(1000), { contentType: "application/json" });
    expect(uploaded.error).toBeNull();

    expect(await usageOf(a.client)).toEqual({ used: 1000, quota: 2147483648 });
    expect((await usageOf(b.client)).used).toBe(0);
  });

  it("oltre il tetto lo storage rifiuta un nuovo file, ma non la miniatura di uno già caricato", async (ctx) => {
    if (!migrated) return ctx.skip();
    const a = await createSignedInUser("full");
    expect((await a.client.storage.from(BUCKET).upload(`${a.id}/doc-1.json`, blob(1000), { contentType: "application/json" })).error).toBeNull();

    // Un tetto più piccolo di quanto già usato: come se lo spazio fosse finito.
    const override = await admin.from("storage_quota_overrides").insert({ user_id: a.id, quota_bytes: 500, note: "test" });
    expect(override.error).toBeNull();
    expect(await usageOf(a.client)).toEqual({ used: 1000, quota: 500 });

    const refused = await a.client.storage.from(BUCKET).upload(`${a.id}/doc-2.json`, blob(10), { contentType: "application/json" });
    expect(refused.error?.message).toMatch(/row-level security/i);

    const thumbnail = await a.client.storage.from(BUCKET).upload(`${a.id}/doc-1-thumb.json`, blob(10), { contentType: "application/json" });
    expect(thumbnail.error).toBeNull();
  });

  it("nessuno può darsi più spazio da solo", async (ctx) => {
    if (!migrated) return ctx.skip();
    const a = await createSignedInUser("self");
    const inserted = await a.client
      .from("storage_quota_overrides")
      .insert({ user_id: a.id, quota_bytes: 999_999_999_999 });
    expect(inserted.error).not.toBeNull();
    expect((await usageOf(a.client)).quota).toBe(2147483648);
  });
});
