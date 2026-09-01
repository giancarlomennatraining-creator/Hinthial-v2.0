/**
 * RLS integration test --- FASE 2 --- Auth + database.
 *
 * Hits a real Supabase project (configured via .env.local) to verify the
 * rule from HINTHIAL_MVP.md sezione 6: "ogni record appartenente a un
 * utente deve essere accessibile esclusivamente a quell'utente."
 *
 * Skips automatically (rather than failing) when the required env vars
 * aren't configured, so `npm run test` stays green for anyone who hasn't
 * set up a Supabase project yet. Uses only throwaway, randomly generated
 * accounts --- never real user data --- and deletes them afterwards.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const noSession = {
  auth: { autoRefreshToken: false, persistSession: false },
};

describe.runIf(canRun)("RLS --- profiles & audit_events", () => {
  // NOTE: describe.runIf still executes this callback synchronously to
  // collect the suite --- only the tests/hooks inside are skipped. Any
  // code that requires SUPABASE_URL/SERVICE_ROLE_KEY must therefore live
  // inside beforeAll/it, not at the top level of this describe block.
  let admin: SupabaseClient;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = {
    email: `hinthial-rls-a-${suffix}@example.com`,
    password: "Rls-Test-Password-1",
    firstName: "RLS",
    lastName: "Test A",
  };
  const userB = {
    email: `hinthial-rls-b-${suffix}@example.com`,
    password: "Rls-Test-Password-2",
    firstName: "RLS",
    lastName: "Test B",
  };

  let userAId = "";
  let userBId = "";
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);

    const createdA = await admin.auth.admin.createUser({
      email: userA.email,
      password: userA.password,
      email_confirm: true,
      user_metadata: { first_name: userA.firstName, last_name: userA.lastName },
    });
    if (createdA.error || !createdA.data.user) {
      throw new Error(
        `Impossibile creare l'utente di test A: ${createdA.error?.message}`,
      );
    }
    userAId = createdA.data.user.id;

    const createdB = await admin.auth.admin.createUser({
      email: userB.email,
      password: userB.password,
      email_confirm: true,
      user_metadata: { first_name: userB.firstName, last_name: userB.lastName },
    });
    if (createdB.error || !createdB.data.user) {
      throw new Error(
        `Impossibile creare l'utente di test B: ${createdB.error?.message}`,
      );
    }
    userBId = createdB.data.user.id;

    clientA = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    clientB = createClient(SUPABASE_URL!, ANON_KEY!, noSession);

    const signInA = await clientA.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    if (signInA.error) {
      throw new Error(`Login utente di test A fallito: ${signInA.error.message}`);
    }

    const signInB = await clientB.auth.signInWithPassword({
      email: userB.email,
      password: userB.password,
    });
    if (signInB.error) {
      throw new Error(`Login utente di test B fallito: ${signInB.error.message}`);
    }
  }, 30_000);

  afterAll(async () => {
    // ON DELETE CASCADE on auth.users takes profiles/audit_events with it.
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  it("auto-creates a profile row for a new user via the signup trigger", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", userAId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: userAId,
      first_name: userA.firstName,
      last_name: userA.lastName,
    });
  });

  it("lets a user read their own profile but not someone else's", async () => {
    const own = await clientA.from("profiles").select("id").eq("id", userAId);
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const others = await clientA.from("profiles").select("id").eq("id", userBId);
    expect(others.error).toBeNull();
    // RLS filters disallowed rows out silently, rather than erroring.
    expect(others.data).toHaveLength(0);
  });

  it("prevents a user from updating another user's profile", async () => {
    const { data, error } = await clientA
      .from("profiles")
      .update({ first_name: "Hacked" })
      .eq("id", userBId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0); // No row matched under RLS --- nothing updated.

    const { data: stillOriginal } = await admin
      .from("profiles")
      .select("first_name")
      .eq("id", userBId)
      .single();
    expect(stillOriginal?.first_name).toBe(userB.firstName);
  });

  it("lets a user insert their own audit event but not one owned by someone else", async () => {
    const ownInsert = await clientA
      .from("audit_events")
      .insert({ owner_id: userAId, event_type: "login" });
    expect(ownInsert.error).toBeNull();

    const spoofedInsert = await clientA
      .from("audit_events")
      .insert({ owner_id: userBId, event_type: "login" });
    expect(spoofedInsert.error).not.toBeNull();
  });

  it("lets a user read only their own audit events", async () => {
    const seedB = await clientB
      .from("audit_events")
      .insert({ owner_id: userBId, event_type: "login" });
    expect(seedB.error).toBeNull();

    const ownEvents = await clientA
      .from("audit_events")
      .select("owner_id")
      .eq("owner_id", userAId);
    expect(ownEvents.data?.every((row) => row.owner_id === userAId)).toBe(true);

    const othersEvents = await clientA
      .from("audit_events")
      .select("owner_id")
      .eq("owner_id", userBId);
    expect(othersEvents.data).toHaveLength(0);
  });
});

describe.skipIf(canRun)("RLS --- profiles & audit_events (skipped)", () => {
  it("requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env.local", () => {
    expect(canRun).toBe(false);
  });
});
