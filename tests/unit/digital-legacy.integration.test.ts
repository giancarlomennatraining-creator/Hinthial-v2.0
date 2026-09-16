/**
 * Integration smoke test for runDigitalLegacyCheck --- FASE 12, secondo
 * passo (v. domain/digital-legacy/automation.ts).
 *
 * Non può verificare una vera transizione per inattività: `last_sign_in_at`
 * è gestito da GoTrue, non scrivibile a piacere via l'API admin ---
 * servirebbe aspettare per davvero il numero di giorni configurato. Verifica
 * invece che l'intera pipeline (listUsers, lettura profili, applicazione
 * dell'azione pura) girhi senza errori contro il database reale, e che un
 * account appena attivo/appena creato non subisca nessuna transizione.
 *
 * Skips automatically (rather than failing) when the required env vars
 * aren't configured, come rls.integration.test.ts. Solo account di test
 * throwaway, cancellati alla fine.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDigitalLegacyCheck } from "@/domain/digital-legacy/automation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("runDigitalLegacyCheck", () => {
  let admin: SupabaseClient;
  let userId = "";

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    email: `hinthial-digital-legacy-${suffix}@example.com`,
    password: "Digital-Legacy-Test-1",
  };

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);

    const created = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { first_name: "Digital", last_name: "Legacy" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Impossibile creare l'utente di test: ${created.error?.message}`);
    }
    userId = created.data.user.id;

    // Un vero accesso, non un timestamp finto --- last_sign_in_at diventa "ora".
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signIn = await anon.auth.signInWithPassword(user);
    if (signIn.error) {
      throw new Error(`Login utente di test fallito: ${signIn.error.message}`);
    }

    const { error } = await admin.from("profiles").update({ digital_legacy_enabled: true }).eq("id", userId);
    if (error) {
      throw new Error(`Impossibile attivare Eredità digitale per il test: ${error.message}`);
    }
  }, 30_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("runs against the real database without throwing", async () => {
    await expect(runDigitalLegacyCheck(admin)).resolves.toBeDefined();
  });

  it("leaves a freshly-active, enabled account in the normal state", async () => {
    await runDigitalLegacyCheck(admin);

    const { data, error } = await admin
      .from("profiles")
      .select("digital_legacy_state, digital_legacy_reminders_sent")
      .eq("id", userId)
      .single();

    expect(error).toBeNull();
    expect(data?.digital_legacy_state).toBe("normal");
    expect(data?.digital_legacy_reminders_sent).toBe(0);
  });

  it("counts the enabled, recently-active user among those checked", async () => {
    const summary = await runDigitalLegacyCheck(admin);
    expect(summary.usersChecked).toBeGreaterThanOrEqual(1);
  });
});
