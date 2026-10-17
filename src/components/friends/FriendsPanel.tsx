"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  deleteFriend,
  getLinkedFriendAvatarUrl,
  listFriends,
  lookupFriendAccount,
  setFriendLinkedUser,
  setFriendStatus,
} from "@/domain/friends/repository";
import {
  acceptFriendRequest,
  listIncomingFriendRequests,
  listOutgoingPendingFriendRequests,
  rejectFriendRequest,
  sendFriendRequest,
  type IncomingFriendRequest,
} from "@/domain/friends/friend-requests";
import {
  listOutgoingPendingGuardianRoleRequests,
  requestGuardianRole,
  revokeGuardianRole,
} from "@/domain/friends/guardian-requests";
import { sendFriendRequestEmail, sendGuardianRoleRequestEmail } from "@/lib/friends/actions";
import { listCapsules, listCapsulesSharedWithMe, syncCapsuleSharesForLinkedFriend } from "@/domain/capsules/repository";
import { sharedFromPerson } from "@/domain/friends/person-capsules";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { PageHelp } from "@/components/help/PageHelp";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import type { FriendListItem, FriendStatus } from "@/domain/friends/types";
import type { CapsuleListItem, SharedCapsuleListItem } from "@/domain/capsules/types";
import { AddressBook } from "@/components/friends/AddressBook";
import { useToast } from "@/components/ui/ToastProvider";
import { AlertTriangleIcon } from "@/components/icons/nav-icons";
import { BTN_PRIMARY, INPUT_FIELD } from "@/components/ui/styles";
import { EmptyListCard } from "@/components/ui/EmptyListCard";

/** Richieste di amicizia in arrivo --- v. richiesta utente: email + un punto ben visibile in app per accettare/rifiutare, non solo l'email. */
function IncomingRequestsBanner({
  requests,
  busyId,
  onAccept,
  onReject,
}: {
  requests: IncomingFriendRequest[];
  busyId: string | null;
  onAccept: (request: IncomingFriendRequest) => void;
  onReject: (request: IncomingFriendRequest) => void;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 p-4">
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {requests.length === 1 ? "1 richiesta di amicizia" : `${requests.length} richieste di amicizia`}
      </p>
      <ul className="flex flex-col gap-2">
        {requests.map((request) => {
          const busy = busyId === request.id;
          return (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm dark:bg-zinc-950"
            >
              <span className="text-zinc-700 dark:text-zinc-300">
                <strong>{request.senderName}</strong> vorrebbe diventare tuo amico su Hinthial.
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAccept(request)}
                  className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  Accetta
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onReject(request)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Rifiuta
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Ogni riga è per default una PERSONA (contatto privato). Diventa AMICO solo con richiesta reciproca accettata (v. domain/friends/friend-requests); solo un AMICO può diventare GUARDIANO, anch'esso su richiesta accettata --- mai flag impostati unilateralmente. */
export function FriendsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [capsules, setCapsules] = useState<CapsuleListItem[]>([]);
  // Le capsule che altri hanno condiviso con me, per mostrare nella scheda di ognuno quelle che mi ha lasciato.
  const [sharedWithMe, setSharedWithMe] = useState<SharedCapsuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FriendStatus | "all">("all");
  // Foto reale di un account collegato, quando l'amico non ne ha una caricata a mano --- risolta a parte (v. resolveLinkedAvatar).
  const [linkedAvatarUrls, setLinkedAvatarUrls] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequest[]>([]);
  // id con una richiesta già inviata e in sospeso: mostra "in attesa" invece del tasto, evita doppie richieste.
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Set<string>>(new Set());
  const [pendingGuardianRequestTo, setPendingGuardianRequestTo] = useState<Set<string>>(new Set());

  // "?created=1"/"?updated=1" arrivano da /friends/new e /friends/[id]/edit dopo un salvataggio riuscito.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  // "&inviteFailed=1": l'invio dell'email di invito non è riuscito, ma l'amico è comunque salvato.
  const [showInviteFailedMessage] = useState(() => searchParams.get("inviteFailed") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Amico aggiunto.");
    if (showUpdatedMessage) showToast("Amico aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace("/friends");
  }, [showCreatedMessage, showUpdatedMessage, router, showToast]);

  /** Foto reale di un amico collegato, quando non ne ha caricata una a mano. Best-effort e silenziosa: un fallimento lascia le iniziali colorate. */
  const resolveLinkedAvatar = useCallback(
    async (friend: FriendListItem) => {
      if (friend.avatarUrl || !friend.linkedUserId) return;
      try {
        const url = await getLinkedFriendAvatarUrl(supabase, friend.id);
        if (url) setLinkedAvatarUrls((prev) => ({ ...prev, [friend.id]: url }));
      } catch {
        // Best-effort --- v. commento sopra.
      }
    },
    [supabase],
  );

  /**
   * Per ogni amico non ancora collegato, verifica se la sua email corrisponde a un account Hinthial registrato ---
   * best-effort e sequenziale (per restare gentile col tetto giornaliero lato server), un fallimento non disturba
   * la pagina. Trovato un collegamento, sincronizza retroattivamente le capsule già condivise prima che l'amico
   * avesse un account, altrimenti resterebbero invisibili in "Condivise con me".
   */
  const checkLinkedAccounts = useCallback(
    async (list: FriendListItem[], ownedCapsules: CapsuleListItem[], ownerId: string) => {
      const sharedCapsules = ownedCapsules.filter((c) => c.status === "shared");

      void Promise.all(list.filter((f) => f.linkedUserId !== null).map((f) => resolveLinkedAvatar(f)));

      for (const friend of list.filter((f) => f.linkedUserId === null)) {
        try {
          const match = await lookupFriendAccount(supabase, friend.email);
          if (!match) continue;
          await setFriendLinkedUser(supabase, friend.id, match.userId);
          setFriends((prev) =>
            prev.map((f) => (f.id === friend.id ? { ...f, linkedUserId: match.userId } : f)),
          );
          void resolveLinkedAvatar({ ...friend, linkedUserId: match.userId });
          await syncCapsuleSharesForLinkedFriend(
            supabase,
            masterKey,
            ownerId,
            friend.id,
            match.userId,
            sharedCapsules,
          );
        } catch {
          // Verifica best-effort --- v. commento sopra.
        }
      }
    },
    [supabase, resolveLinkedAvatar, masterKey],
  );

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Sessione non valida.");
      setCurrentUser({ id: user.id, email: user.email });

      const [friendsResult, capsulesResult, sharedResult, incoming, outgoingFriend, outgoingGuardian] = await Promise.all([
        listFriends(supabase, masterKey),
        listCapsules(supabase, masterKey),
        listCapsulesSharedWithMe(supabase).catch((): SharedCapsuleListItem[] => []),
        listIncomingFriendRequests(supabase, user.id),
        listOutgoingPendingFriendRequests(supabase, user.id),
        listOutgoingPendingGuardianRoleRequests(supabase, user.id),
      ]);
      setFriends(friendsResult);
      setCapsules(capsulesResult);
      setSharedWithMe(sharedResult);
      setIncomingRequests(incoming);
      setPendingFriendRequestTo(new Set(outgoingFriend.map((r) => r.recipientId)));
      setPendingGuardianRequestTo(new Set(outgoingGuardian));
      void checkLinkedAccounts(friendsResult, capsulesResult, user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare gli amici.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, checkLinkedAccounts]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleSetStatus(friend: FriendListItem, status: FriendStatus) {
    setBusyId(friend.id);
    setError(null);
    try {
      await setFriendStatus(supabase, friend.id, status);
      setFriends((prev) => prev.map((c) => (c.id === friend.id ? { ...c, status } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato dell'amico.");
    } finally {
      setBusyId(null);
    }
  }

  /** "Richiedi amicizia" --- solo per una PERSONA già collegata a un account (v. richiesta utente). */
  async function handleRequestFriendship(friend: FriendListItem) {
    if (!currentUser || !friend.linkedUserId) return;
    setBusyId(friend.id);
    setError(null);
    try {
      await sendFriendRequest(supabase, currentUser.id, currentUser.email, friend.linkedUserId);
      setPendingFriendRequestTo((prev) => new Set(prev).add(friend.linkedUserId!));
      showToast("Richiesta di amicizia inviata.");
      try {
        await sendFriendRequestEmail(friend.email);
      } catch {
        // Best-effort: la richiesta resta comunque visibile nella sua scheda Amici.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile inviare la richiesta di amicizia.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAcceptIncomingRequest(request: IncomingFriendRequest) {
    if (!currentUser) return;
    setBusyId(request.id);
    setError(null);
    try {
      await acceptFriendRequest(supabase, masterKey, currentUser.id, request);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast(`Ora sei amico di ${request.senderName}.`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accettare la richiesta.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRejectIncomingRequest(request: IncomingFriendRequest) {
    setBusyId(request.id);
    setError(null);
    try {
      await rejectFriendRequest(supabase, request.id);
      setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast("Richiesta di amicizia rifiutata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rifiutare la richiesta.");
    } finally {
      setBusyId(null);
    }
  }

  /** "Chiedi di diventare guardiano" (isGuardian passa a true solo dopo accettazione) oppure "Rimuovi dai guardiani" (nessun consenso richiesto per togliere). */
  async function handleToggleGuardian(friend: FriendListItem) {
    if (!currentUser) return;
    setBusyId(friend.id);
    setError(null);
    try {
      if (friend.isGuardian) {
        await revokeGuardianRole(supabase, friend.id);
        setFriends((prev) => prev.map((c) => (c.id === friend.id ? { ...c, isGuardian: false } : c)));
        showToast("Guardiano rimosso.");
      } else if (friend.linkedUserId) {
        await requestGuardianRole(supabase, currentUser.id, friend.id, friend.linkedUserId);
        setPendingGuardianRequestTo((prev) => new Set(prev).add(friend.linkedUserId!));
        showToast("Richiesta di diventare guardiano inviata — diventerà guardiano solo se accetta.");
        try {
          await sendGuardianRoleRequestEmail(friend.linkedUserId);
        } catch {
          // Best-effort --- la richiesta resta comunque visibile nella sua scheda Protetti.
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare l'amico.");
    } finally {
      setBusyId(null);
    }
  }

  function capsulesFor(friend: FriendListItem): CapsuleListItem[] {
    return capsules.filter((capsule) => capsule.relatedFriends.some((c) => c.id === friend.id));
  }

  /** Foto caricata a mano, altrimenti quella reale dell'account collegato (se già risolta), altrimenti nessuna --- v. resolveLinkedAvatar sopra. */
  function avatarUrlFor(friend: FriendListItem): string | null {
    return friend.avatarUrl ?? linkedAvatarUrls[friend.id] ?? null;
  }

  /** Nessun tasto se già amico, se non collegato, o se una richiesta è già in sospeso. */
  function canRequestFriendship(friend: FriendListItem): boolean {
    return (
      !friend.isFriend &&
      friend.linkedUserId !== null &&
      !pendingFriendRequestTo.has(friend.linkedUserId)
    );
  }

  function isFriendRequestPending(friend: FriendListItem): boolean {
    return friend.linkedUserId !== null && pendingFriendRequestTo.has(friend.linkedUserId);
  }

  function isGuardianRequestPending(friend: FriendListItem): boolean {
    return friend.linkedUserId !== null && pendingGuardianRequestTo.has(friend.linkedUserId);
  }

  const filteredFriends = friends.filter((friend) => statusFilter === "all" || friend.status === statusFilter);


  async function handleDelete(friend: FriendListItem) {
    if (!window.confirm(`Eliminare l'amico "${friend.name}"?`)) return;

    setBusyId(friend.id);
    setError(null);
    try {
      await deleteFriend(supabase, friend.id);
      setFriends((prev) => prev.filter((c) => c.id !== friend.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare l'amico.");
    } finally {
      setBusyId(null);
    }
  }

  function guardianOrFriendshipMenuItems(friend: FriendListItem, busy: boolean) {
    return (
      <>
        {canRequestFriendship(friend) ? (
          <RowMenuItem disabled={busy} onClick={() => handleRequestFriendship(friend)}>
            Richiedi amicizia
          </RowMenuItem>
        ) : null}
        {friend.isFriend ? (
          <RowMenuItem disabled={busy || isGuardianRequestPending(friend)} onClick={() => handleToggleGuardian(friend)}>
            {friend.isGuardian
              ? "Rimuovi dai guardiani"
              : isGuardianRequestPending(friend)
                ? "Richiesta di guardiano in attesa"
                : "Chiedi di diventare guardiano"}
          </RowMenuItem>
        ) : null}
      </>
    );
  }

  /** Il menu "⋮" di una persona: lo stesso nella vista a tabella e nella scheda della rubrica. */
  function rowMenu(friend: FriendListItem) {
    const busy = busyId === friend.id;
    return (
      <RowActionsMenu label={`Azioni per ${friend.name}`}>
        {guardianOrFriendshipMenuItems(friend, busy)}
        {friend.status !== "revoked" ? (
          <RowMenuItem disabled={busy} onClick={() => handleSetStatus(friend, "revoked")}>
            Revoca
          </RowMenuItem>
        ) : null}
        <RowMenuItem disabled={busy} onClick={() => router.push(`/friends/${friend.id}/edit`)}>
          Modifica
        </RowMenuItem>
        <RowMenuItem disabled={busy} danger onClick={() => handleDelete(friend)}>
          Elimina
        </RowMenuItem>
      </RowActionsMenu>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 w-full sm:flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-title">
              Amici
            </h1>
            <PageHelp
              title="Amici"
              tips={[
                { icon: "👤", text: "Un nuovo contatto resta una persona privata finché non richiede e accetta l'amicizia." },
                { icon: "🛡️", text: "Solo un amico può diventare guardiano della tua eredità digitale." },
                { icon: "🔒", text: "Ogni dato sui tuoi amici resta cifrato come tutto il resto." },
              ]}
            />
          </div>
          <Link href="/friends/protected" className="mt-1 text-sm font-medium text-accent hover:underline">
            Vedi chi proteggi
          </Link>
        </div>
        <Link
          href="/friends/new"
          className={`hidden shrink-0 ${BTN_PRIMARY} sm:block`}
        >
          + Aggiungi amico
        </Link>
      </div>

      <MobileAddFab href="/friends/new" label="Aggiungi amico" />

      <IncomingRequestsBanner
        requests={incomingRequests}
        busyId={busyId}
        onAccept={handleAcceptIncomingRequest}
        onReject={handleRejectIncomingRequest}
      />

      {showInviteFailedMessage ? (
        <p className="flex items-start gap-1.5 text-sm text-orange-700 dark:text-orange-400">
          <AlertTriangleIcon width={16} height={16} className="mt-0.5 shrink-0" />
          Non è stato possibile inviare l&apos;invito via email. L&apos;amico è stato comunque
          salvato.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : friends.length === 0 ? (
        <EmptyListCard text="Nessun amico ancora." actionHref="/friends/new" actionLabel="Aggiungi la prima persona" />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FriendStatus | "all")}
              aria-label="Filtra per stato"
              className={INPUT_FIELD}
            >
              <option value="all">Tutti</option>
              <option value="active">Attivi</option>
              <option value="revoked">Revocati</option>
            </select>
          </div>

          {filteredFriends.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun amico corrisponde ai filtri.
            </p>
          ) : (
            <AddressBook
              friends={filteredFriends}
              capsulesFor={capsulesFor}
              sharedFrom={(friend) => sharedFromPerson(sharedWithMe, friend.linkedUserId)}
              avatarUrlFor={avatarUrlFor}
              isFriendRequestPending={isFriendRequestPending}
              isGuardianRequestPending={isGuardianRequestPending}
              canRequestFriendship={canRequestFriendship}
              busyId={busyId}
              onRequestFriendship={handleRequestFriendship}
              onToggleGuardian={handleToggleGuardian}
              renderMenu={rowMenu}
            />
          )}
        </>
      )}
    </div>
  );
}
