/**
 * Integration test for the guardian phase of "Eredità digitale" (FASE 12,
 * coinvolgimento guardiani) --- a real owner + a real linked guardian
 * account, against the real database, verifying the whole path end to
 * end: notifyGuardians creates a request, the guardian can read it (and
 * the owner's name) under RLS, responding "unreachable" reaches quorum
 * (a single guardian already satisfies "majority") and moves the owner
 * to "guardians_confirmed" once runDigitalLegacyCheck notices, and the
 * response gets logged under the OWNER's audit trail (not the
 * guardian's) via the SECURITY DEFINER RPC.
 *
 * Cannot simulate real day-scale inactivity (v. digital-legacy.integration.
 * test.ts) to reach "awaiting_guardians" the normal way --- a real
 * sign-in always has last_sign_in_at = now, which would always be AFTER
 * any backdated `digital_legacy_state_entered_at`, triggering the
 * (correct) reset-on-recent-login rule instead of the transition being
 * tested. Sidesteps this by setting the owner's state to
 * "awaiting_guardians" directly and calling notifyGuardians() on its
 * own (exported for exactly this) --- the day-scale gate into that
 * state is already covered by the pure-function unit tests instead.
 *
 * Skips automatically (rather than failing) when the required env vars
 * aren't configured, like the other integration tests. Only throwaway
 * accounts, deleted at the end.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notifyGuardians, runDigitalLegacyCheck } from "@/domain/digital-legacy/automation";
import {
  getGuardianVerificationRequest,
  respondToGuardianVerificationRequest,
} from "@/domain/digital-legacy/guardians";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("guardian verification (FASE 12)", () => {
  let admin: SupabaseClient;
  let guardianClient: SupabaseClient;
  let ownerId = "";
  let guardianId = "";
  let requestId = "";

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = {
    email: `hinthial-dl-owner-${suffix}@example.com`,
    password: "Digital-Legacy-Owner-1",
  };
  const guardian = {
    email: `hinthial-dl-guardian-${suffix}@example.com`,
    password: "Digital-Legacy-Guardian-1",
  };

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);

    const createdOwner = await admin.auth.admin.createUser({
      email: owner.email,
      password: owner.password,
      email_confirm: true,
      user_metadata: { first_name: "Ada", last_name: "Owner" },
    });
    if (createdOwner.error || !createdOwner.data.user) {
      throw new Error(`Impossibile creare il proprietario di test: ${createdOwner.error?.message}`);
    }
    ownerId = createdOwner.data.user.id;

    const createdGuardian = await admin.auth.admin.createUser({
      email: guardian.email,
      password: guardian.password,
      email_confirm: true,
      user_metadata: { first_name: "Grace", last_name: "Guardian" },
    });
    if (createdGuardian.error || !createdGuardian.data.user) {
      throw new Error(`Impossibile creare il guardiano di test: ${createdGuardian.error?.message}`);
    }
    guardianId = createdGuardian.data.user.id;

    // Un vero accesso per entrambi --- last_sign_in_at diventa "ora" per il proprietario.
    const ownerAnon = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const ownerSignIn = await ownerAnon.auth.signInWithPassword(owner);
    if (ownerSignIn.error) throw new Error(`Login proprietario fallito: ${ownerSignIn.error.message}`);

    guardianClient = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const guardianSignIn = await guardianClient.auth.signInWithPassword(guardian);
    if (guardianSignIn.error) throw new Error(`Login guardiano fallito: ${guardianSignIn.error.message}`);

    // Il guardiano è un amico COLLEGATO del proprietario (v. FriendsPanel.tsx: solo un
    // guardiano collegato è raggiungibile dal server).
    const { error: friendError } = await admin.from("friends").insert({
      owner_id: ownerId,
      encrypted_name: "test-encrypted-name",
      encrypted_email: "test-encrypted-email",
      role: "Test",
      status: "active",
      is_guardian: true,
      linked_user_id: guardianId,
    });
    if (friendError) {
      throw new Error(`Impossibile creare il collegamento amico/guardiano: ${friendError.message}`);
    }

    // Direttamente in "awaiting_guardians" --- v. doc comment del file
    // per il perché non si può arrivarci simulando davvero i giorni di
    // inattività in questo test. state_entered_at "ora" (dopo i login
    // veri qui sopra): evita di far scattare per errore il reset
    // "accesso dopo l'inizio dello stato".
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        digital_legacy_enabled: true,
        digital_legacy_state: "awaiting_guardians",
        digital_legacy_state_entered_at: new Date().toISOString(),
      })
      .eq("id", ownerId);
    if (profileError) {
      throw new Error(`Impossibile impostare lo stato di test: ${profileError.message}`);
    }

    await notifyGuardians(admin, ownerId);
  }, 30_000);

  afterAll(async () => {
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (guardianId) await admin.auth.admin.deleteUser(guardianId);
  });

  it("creates a request for the linked guardian, and a check finds nothing new to do yet", async () => {
    const { data: request, error: requestError } = await admin
      .from("guardian_verification_requests")
      .select("id, response")
      .eq("owner_id", ownerId)
      .eq("guardian_user_id", guardianId)
      .single();
    expect(requestError).toBeNull();
    expect(request?.response).toBeNull();
    requestId = request!.id;

    // Nessuna risposta ancora: il quorum non è soddisfatto, resta in awaiting_guardians.
    await runDigitalLegacyCheck(admin);
    const { data: profile } = await admin
      .from("profiles")
      .select("digital_legacy_state")
      .eq("id", ownerId)
      .single();
    expect(profile?.digital_legacy_state).toBe("awaiting_guardians");
  });

  it("lets the guardian (and only the guardian) read the request and the owner's real name", async () => {
    const found = await getGuardianVerificationRequest(guardianClient, requestId);
    expect(found?.ownerName).toBe("Ada Owner");
    expect(found?.response).toBeNull();

    // Un'altra sessione anonima (nessun accesso concesso) non vede nulla.
    const stranger = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const { data: strangerRow } = await stranger
      .from("guardian_verification_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    expect(strangerRow).toBeNull();
  });

  it("moves to guardians_confirmed once the guardian confirms unreachable, and logs it under the OWNER's audit trail", async () => {
    await respondToGuardianVerificationRequest(guardianClient, requestId, "unreachable");

    await runDigitalLegacyCheck(admin);

    const { data: profile } = await admin
      .from("profiles")
      .select("digital_legacy_state")
      .eq("id", ownerId)
      .single();
    // Un solo guardiano collegato: "majority" (il default) è già soddisfatto da un solo "unreachable".
    expect(profile?.digital_legacy_state).toBe("guardians_confirmed");

    const { data: events } = await admin
      .from("audit_events")
      .select("event_type")
      .eq("owner_id", ownerId);
    const eventTypes = (events ?? []).map((e) => e.event_type);
    expect(eventTypes).toContain("digital_legacy_guardian_responded");
    expect(eventTypes).toContain("digital_legacy_guardians_confirmed");
  });

  // Fasi 5-7 (verifica formale, attesa finale, apertura capsule) da qui
  // in poi --- lo stesso proprietario/guardiano di sopra, già in
  // "guardians_confirmed". `now` iniettato in runDigitalLegacyCheck (v.
  // doc comment della funzione) per avanzare i giorni senza doverli
  // aspettare per davvero, senza toccare last_sign_in_at/state_entered_at
  // reali --- l'unico modo di testare fasi con una vera durata senza
  // incappare di nuovo nel problema del reset-su-login descritto sopra.
  let capsuleId = "";

  it("shares a capsule whose open_at is far in the future --- not readable by the recipient yet", async () => {
    const { data: capsule, error: capsuleError } = await admin
      .from("capsules")
      .insert({
        owner_id: ownerId,
        encrypted_payload: "test-encrypted-payload",
        status: "shared",
        open_at: new Date(Date.now() + 1000 * 86_400_000).toISOString(), // 1000 giorni nel futuro
      })
      .select("id")
      .single();
    expect(capsuleError).toBeNull();
    capsuleId = capsule!.id;

    const { error: shareError } = await admin.from("capsule_shares").insert({
      capsule_id: capsuleId,
      owner_id: ownerId,
      recipient_user_id: guardianId, // riusa lo stesso account guardiano come destinatario --- basta per verificare l'RLS
    });
    expect(shareError).toBeNull();

    const { error: keyError } = await admin.from("capsule_share_keys").insert({
      capsule_id: capsuleId,
      owner_id: ownerId,
      recipient_user_id: guardianId,
      ephemeral_public_key: "test-ephemeral-key",
      encrypted_payload_for_recipient: "test-encrypted-for-recipient",
    });
    expect(keyError).toBeNull();

    // Prima dell'attivazione: open_at lontanissima, nessun accesso concesso.
    const { data: readBefore } = await guardianClient
      .from("capsule_share_keys")
      .select("id")
      .eq("capsule_id", capsuleId)
      .maybeSingle();
    expect(readBefore).toBeNull();
  });

  it("advances guardians_confirmed -> formal_verification immediately, with no waiting period of its own", async () => {
    const now = new Date();
    await runDigitalLegacyCheck(admin, now);

    const { data: profile } = await admin
      .from("profiles")
      .select("digital_legacy_state, digital_legacy_state_entered_at")
      .eq("id", ownerId)
      .single();
    expect(profile?.digital_legacy_state).toBe("formal_verification");
  });

  it("waits out formalVerificationDays (default 14) before starting the final wait", async () => {
    const { data: before } = await admin
      .from("profiles")
      .select("digital_legacy_state_entered_at")
      .eq("id", ownerId)
      .single();
    const enteredAt = new Date(before!.digital_legacy_state_entered_at);

    // Ancora presto: nessun cambiamento.
    await runDigitalLegacyCheck(admin, new Date(enteredAt.getTime() + 5 * 86_400_000));
    const { data: tooSoon } = await admin
      .from("profiles")
      .select("digital_legacy_state")
      .eq("id", ownerId)
      .single();
    expect(tooSoon?.digital_legacy_state).toBe("formal_verification");

    // 14 giorni dopo: passa all'attesa finale.
    await runDigitalLegacyCheck(admin, new Date(enteredAt.getTime() + 15 * 86_400_000));
    const { data: elapsed } = await admin
      .from("profiles")
      .select("digital_legacy_state")
      .eq("id", ownerId)
      .single();
    expect(elapsed?.digital_legacy_state).toBe("final_wait");
  });

  it("waits out finalWaitDays (default 14), then triggers the release --- opening the capsule to its recipient", async () => {
    const { data: before } = await admin
      .from("profiles")
      .select("digital_legacy_state_entered_at")
      .eq("id", ownerId)
      .single();
    const enteredAt = new Date(before!.digital_legacy_state_entered_at);

    await runDigitalLegacyCheck(admin, new Date(enteredAt.getTime() + 15 * 86_400_000));

    const { data: profile } = await admin
      .from("profiles")
      .select("digital_legacy_state, digital_legacy_triggered_at")
      .eq("id", ownerId)
      .single();
    expect(profile?.digital_legacy_state).toBe("triggered");
    expect(profile?.digital_legacy_triggered_at).not.toBeNull();

    const { data: events } = await admin.from("audit_events").select("event_type").eq("owner_id", ownerId);
    expect((events ?? []).map((e) => e.event_type)).toContain("digital_legacy_triggered");

    // Il cuore della fase 7: la capsula, con open_at ancora a 1000 giorni
    // nel futuro, è ora leggibile dal destinatario --- l'irraggiungibilità
    // confermata ha fatto scattare l'accesso indipendentemente dalla data.
    const { data: readAfter, error: readAfterError } = await guardianClient
      .from("capsule_share_keys")
      .select("id, encrypted_payload_for_recipient")
      .eq("capsule_id", capsuleId)
      .single();
    expect(readAfterError).toBeNull();
    expect(readAfter?.encrypted_payload_for_recipient).toBe("test-encrypted-for-recipient");
  });

  it("still resets to normal on a genuine later login, without undoing the already-granted capsule access", async () => {
    // digital_legacy_state_entered_at è rimasto molto avanti nel "futuro
    // finto" per via delle chiamate con `now` iniettato qui sopra --- un
    // vero accesso adesso sarebbe comunque cronologicamente PRIMA di
    // quel valore, e non farebbe scattare il reset per errore di
    // impostazione del test, non del codice. Lo si riporta a un istante
    // reale nel passato apposta per questo test: "triggered" è uno
    // stato terminale (v. computeDigitalLegacyTransition), retrodatarlo
    // non rischia di fargli saltare qualche altra transizione.
    await admin
      .from("profiles")
      .update({ digital_legacy_state_entered_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() })
      .eq("id", ownerId);

    // Un vero secondo accesso, DOPO quell'istante.
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signIn = await anon.auth.signInWithPassword(owner);
    expect(signIn.error).toBeNull();

    await runDigitalLegacyCheck(admin);

    const { data: profile } = await admin
      .from("profiles")
      .select("digital_legacy_state, digital_legacy_triggered_at")
      .eq("id", ownerId)
      .single();
    expect(profile?.digital_legacy_state).toBe("normal");
    expect(profile?.digital_legacy_triggered_at).not.toBeNull(); // mai azzerato

    // L'accesso già concesso resta --- non si può ritirare.
    const { data: stillReadable } = await guardianClient
      .from("capsule_share_keys")
      .select("id")
      .eq("capsule_id", capsuleId)
      .maybeSingle();
    expect(stillReadable).not.toBeNull();
  });
});
