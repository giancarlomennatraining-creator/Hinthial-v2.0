/**
 * Integration test for the "Amici v2" model (v. richiesta utente):
 * PERSONA (contatto privato) vs AMICO (amicizia reciproca, richiesta +
 * accettata) vs GUARDIANO (una seconda richiesta distinta, possibile
 * solo tra AMICI). Verificato contro il database reale, come
 * guardian-verification.integration.test.ts (stesso motivo: RLS e RPC
 * SECURITY DEFINER non si possono verificare bene con un database
 * finto) --- quel test resta lo smoke test leggero della sola pagina
 * per la verifica di "Eredità digitale" già in corso; qui si copre
 * invece l'intero nuovo modello di richieste, dalla A alla Z.
 *
 * Skips automatically (rather than failing) when the required env vars
 * aren't configured, like the other integration tests. Only throwaway
 * accounts, deleted at the end.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFriend, listFriends, setFriendLinkedUser } from "@/domain/friends/repository";
import {
  acceptFriendRequest,
  listIncomingFriendRequests,
  listOutgoingPendingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
} from "@/domain/friends/friend-requests";
import {
  acceptGuardianRoleRequest,
  listIncomingGuardianRoleRequests,
  listMyProtected,
  rejectGuardianRoleRequest,
  requestGuardianRole,
  resignAsGuardian,
  revokeGuardianRole,
} from "@/domain/friends/guardian-requests";
import { generateSymmetricKey } from "@/lib/crypto/symmetric-key";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const canRun = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

describe.runIf(canRun)("friend requests + guardian role requests (Amici v2)", () => {
  let admin: SupabaseClient;
  let aClient: SupabaseClient;
  let bClient: SupabaseClient;
  let cClient: SupabaseClient;
  let aId = "";
  let bId = "";
  let cId = "";
  let aMasterKey: CryptoKey;
  let bMasterKey: CryptoKey;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userA = { email: `hinthial-fr-a-${suffix}@example.com`, password: "Friend-Request-A-1" };
  const userB = { email: `hinthial-fr-b-${suffix}@example.com`, password: "Friend-Request-B-1" };
  const userC = { email: `hinthial-fr-c-${suffix}@example.com`, password: "Friend-Request-C-1" };

  async function createSignedInUser(user: { email: string; password: string }, firstName: string) {
    const created = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: "Test" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Impossibile creare l'utente di test: ${created.error?.message}`);
    }
    const client = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const signIn = await client.auth.signInWithPassword(user);
    if (signIn.error) throw new Error(`Login fallito: ${signIn.error.message}`);
    return { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, noSession);

    const a = await createSignedInUser(userA, "Ada");
    aId = a.id;
    aClient = a.client;

    const b = await createSignedInUser(userB, "Grace");
    bId = b.id;
    bClient = b.client;

    const c = await createSignedInUser(userC, "Charles");
    cId = c.id;
    cClient = c.client;

    aMasterKey = await generateSymmetricKey();
    bMasterKey = await generateSymmetricKey();
  }, 30_000);

  afterAll(async () => {
    for (const id of [aId, bId, cId]) {
      if (id) await admin.auth.admin.deleteUser(id);
    }
  });

  let friendRowIdForB = "";
  let friendRequestId = "";

  it("A adds B as a PERSONA (linked, but not yet a friend) --- isFriend stays false", async () => {
    const { id } = await createFriend(aClient, aMasterKey, aId, {
      name: "Grace Guardian",
      email: userB.email,
      firstName: "Grace",
      lastName: "Guardian",
      role: "Amica",
    });
    friendRowIdForB = id;
    await setFriendLinkedUser(aClient, friendRowIdForB, bId);

    const friends = await listFriends(aClient, aMasterKey);
    const row = friends.find((f) => f.id === friendRowIdForB);
    expect(row?.isFriend).toBe(false);
    expect(row?.linkedUserId).toBe(bId);
  });

  it("cannot request a guardian role for a mere PERSONA (DB enforces is_friend = true)", async () => {
    const { error } = await aClient.from("guardian_role_requests").insert({
      owner_id: aId,
      guardian_user_id: bId,
      friend_id: friendRowIdForB,
    });
    expect(error).not.toBeNull();
  });

  it("A sends a friend request to B --- only B (not a stranger) can see it", async () => {
    await sendFriendRequest(aClient, aId, userA.email, bId);

    const incoming = await listIncomingFriendRequests(bClient, bId);
    expect(incoming).toHaveLength(1);
    friendRequestId = incoming[0].id;
    expect(incoming[0].senderName).toBe("Ada Test");
    expect(incoming[0].senderEmail).toBe(userA.email);

    const outgoing = await listOutgoingPendingFriendRequests(aClient, aId);
    expect(outgoing.map((r) => r.recipientId)).toContain(bId);

    const stranger = createClient(SUPABASE_URL!, ANON_KEY!, noSession);
    const { data: strangerRow } = await stranger
      .from("friend_requests")
      .select("id")
      .eq("id", friendRequestId)
      .maybeSingle();
    expect(strangerRow).toBeNull();
  });

  it("B accepts --- both sides become AMICO, and B gets its own encrypted row for A", async () => {
    const incoming = await listIncomingFriendRequests(bClient, bId);
    await acceptFriendRequest(bClient, bMasterKey, bId, incoming[0]);

    const aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isFriend).toBe(true);

    const bFriends = await listFriends(bClient, bMasterKey);
    const bRowForA = bFriends.find((f) => f.linkedUserId === aId);
    expect(bRowForA?.isFriend).toBe(true);
    expect(bRowForA?.name).toBe("Ada Test");
    expect(bRowForA?.email).toBe(userA.email);
  });

  let guardianRequestId = "";

  it("A asks B (now a real AMICO) to become guardian --- B sees the request with A's real name", async () => {
    await requestGuardianRole(aClient, aId, friendRowIdForB, bId);

    const incoming = await listIncomingGuardianRoleRequests(bClient, bId);
    expect(incoming).toHaveLength(1);
    guardianRequestId = incoming[0].id;
    expect(incoming[0].ownerName).toBe("Ada Test");
  });

  it("B rejects instead --- A's friend row stays without isGuardian, and A can ask again", async () => {
    await rejectGuardianRoleRequest(bClient, guardianRequestId);

    const aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isGuardian).toBe(false);

    // Un nuovo tentativo, dopo il rifiuto, non è bloccato dall'indice
    // unico (parziale, solo sulle righe "pending" --- come per le
    // richieste di amicizia).
    await requestGuardianRole(aClient, aId, friendRowIdForB, bId);
    const incoming = await listIncomingGuardianRoleRequests(bClient, bId);
    expect(incoming).toHaveLength(1);
    guardianRequestId = incoming[0].id;
  });

  it("B accepts --- A's friend row becomes isGuardian, and B sees A in 'Protetti'", async () => {
    await acceptGuardianRoleRequest(bClient, guardianRequestId);

    const aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isGuardian).toBe(true);

    const protectedList = await listMyProtected(bClient, bId);
    expect(protectedList).toHaveLength(1);
    expect(protectedList[0].ownerId).toBe(aId);
    expect(protectedList[0].ownerName).toBe("Ada Test");
  });

  it("B resigns --- A's friend row loses isGuardian, and B's 'Protetti' list empties", async () => {
    await resignAsGuardian(bClient, guardianRequestId);

    const aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isGuardian).toBe(false);

    const protectedList = await listMyProtected(bClient, bId);
    expect(protectedList).toHaveLength(0);
  });

  it("A can re-request after a resignation, B accepts again, then A revokes directly", async () => {
    await requestGuardianRole(aClient, aId, friendRowIdForB, bId);
    const incoming = await listIncomingGuardianRoleRequests(bClient, bId);
    expect(incoming).toHaveLength(1);
    await acceptGuardianRoleRequest(bClient, incoming[0].id);

    let aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isGuardian).toBe(true);

    // A rimuove direttamente --- nessun consenso richiesto per TOGLIERE (v. richiesta utente).
    await revokeGuardianRole(aClient, friendRowIdForB);

    aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForB)?.isGuardian).toBe(false);

    const protectedList = await listMyProtected(bClient, bId);
    expect(protectedList).toHaveLength(0);
  });

  it("a rejected friend request leaves the sender's row as PERSONA, and can be re-sent later", async () => {
    const { id: friendRowIdForC } = await createFriend(aClient, aMasterKey, aId, {
      name: "Charles Test",
      email: userC.email,
      firstName: "Charles",
      lastName: "Test",
      role: "Amico",
    });
    await setFriendLinkedUser(aClient, friendRowIdForC, cId);

    await sendFriendRequest(aClient, aId, userA.email, cId);
    const incoming = await listIncomingFriendRequests(cClient, cId);
    expect(incoming).toHaveLength(1);
    await rejectFriendRequest(cClient, incoming[0].id);

    const aFriends = await listFriends(aClient, aMasterKey);
    expect(aFriends.find((f) => f.id === friendRowIdForC)?.isFriend).toBe(false);

    // Un nuovo tentativo, dopo il rifiuto, non è bloccato dall'indice unico
    // (parziale, solo sulle righe "pending" --- v. migrazione friend_requests).
    await sendFriendRequest(aClient, aId, userA.email, cId);
    const secondAttempt = await listIncomingFriendRequests(cClient, cId);
    expect(secondAttempt).toHaveLength(1);
  });
});
