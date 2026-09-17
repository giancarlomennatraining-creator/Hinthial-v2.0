"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
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
import { Avatar } from "@/components/ui/Avatar";
import { listCapsules, syncCapsuleSharesForLinkedFriend } from "@/domain/capsules/repository";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { SearchInput } from "@/components/ui/SearchInput";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { ListViewToggle } from "@/components/ui/ListViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { useListViewPreferences } from "@/components/layout/ListViewPreferencesProvider";
import { TABLE_PAGE_SIZE } from "@/lib/list-view";
import { applySort, toggleSort, type SortState } from "@/lib/table-sort";
import type { FriendListItem, FriendStatus } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { useToast } from "@/components/ui/ToastProvider";
import { AlertTriangleIcon } from "@/components/icons/nav-icons";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Come formatDate, ma con l'orario --- solo per l'apertura di una capsula, l'unica data dell'app che ora ne porta uno significativo. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

const STATUS_LABEL: Record<FriendStatus, string> = {
  active: "Attivo",
  revoked: "Revocato",
};

const STATUS_BADGE_CLASS: Record<FriendStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  revoked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

type SortColumn = "name" | "email" | "role" | "status" | "capsules";

/** Al passaggio del mouse, l'elenco delle capsule che indicano questo amico tra i destinatari. */
function CapsulesBadge({ capsules }: { capsules: CapsuleListItem[] }) {
  if (capsules.length === 0) return null;

  return (
    <span className="group relative inline-flex shrink-0">
      <span className="cursor-default rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        📦 {capsules.length} {capsules.length === 1 ? "capsula" : "capsule"}
      </span>
      <span className="invisible absolute left-0 top-full z-10 mt-1 w-64 rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-700 opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        <ul className="flex flex-col gap-1.5">
          {capsules.map((capsule) => (
            <li key={capsule.id}>
              <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                {capsule.title}
              </p>
              <p className="text-zinc-500 dark:text-zinc-400">
                creata il {formatDate(capsule.createdAt)}
                {capsule.openAt ? ` · apertura prevista ${formatDateTime(capsule.openAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </span>
    </span>
  );
}

/** Badge "🤝 Amico" (amicizia reciproca confermata) --- v. FriendListItem.isFriend. Niente badge per una PERSONA: è lo stato di partenza, non serve segnalarlo. */
function FriendBadge({ isFriend }: { isFriend: boolean }) {
  if (!isFriend) return null;
  return (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
      🤝 Amico
    </span>
  );
}

/** Badge "🛡️ Guardiano" --- ora possibile solo per un AMICO che ha già accettato (v. domain/friends/guardian-requests), mai un flag senza consenso. */
function GuardianBadge({ isGuardian }: { isGuardian: boolean }) {
  if (!isGuardian) return null;
  return (
    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
      🛡️ Guardiano
    </span>
  );
}

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

/**
 * FASE 7 --- Amico: solo struttura dati e gestione dello stato, nessuno
 * sblocco automatico dei dati (v. HINTHIAL_MVP.md).
 *
 * Modello v2 (v. richiesta utente): ogni riga qui è per default una
 * PERSONA, un contatto privato nella propria rubrica. Diventa un AMICO
 * (`isFriend`) solo se una richiesta di amicizia reciproca viene
 * accettata da entrambe le parti (v. domain/friends/friend-requests) ---
 * mai un flag impostato unilateralmente. Solo un AMICO può diventare
 * GUARDIANO (`isGuardian`), e anche questo richiede una richiesta
 * apposita accettata (v. domain/friends/guardian-requests): chi viene
 * indicato deve sapere di esserlo, non è più solo un flag silenzioso.
 */
export function FriendsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [capsules, setCapsules] = useState<CapsuleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FriendStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<SortColumn> | null>({ key: "name", direction: "asc" });
  // Foto reale di un account collegato, quando l'amico non ne ha una
  // caricata a mano --- risolta a parte per non rallentare/appesantire
  // ogni caricamento dell'elenco (v. resolveLinkedAvatar sotto).
  const [linkedAvatarUrls, setLinkedAvatarUrls] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<IncomingFriendRequest[]>([]);
  // recipientId (amicizia) / guardianUserId (guardiano) con una richiesta
  // già inviata e ancora in sospeso --- per mostrare "in attesa" invece
  // del tasto, evitando doppie richieste dalla stessa riga.
  const [pendingFriendRequestTo, setPendingFriendRequestTo] = useState<Set<string>>(new Set());
  const [pendingGuardianRequestTo, setPendingGuardianRequestTo] = useState<Set<string>>(new Set());

  const { modeFor } = useListViewPreferences();
  const viewMode = modeFor("friends");

  // "?created=1"/"?updated=1" arrivano da /friends/new e da
  // /friends/[id]/edit dopo un salvataggio riuscito --- v.
  // CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  // "&inviteFailed=1" si aggiunge agli stessi redirect quando la
  // checkbox "Invita ... su Hinthial" era spuntata ma l'invio dell'email
  // non è riuscito --- l'amico è comunque salvato, non è un errore che
  // blocca il salvataggio, solo un avviso a parte.
  const [showInviteFailedMessage] = useState(() => searchParams.get("inviteFailed") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Amico aggiunto.");
    if (showUpdatedMessage) showToast("Amico aggiornato.");
    if (showCreatedMessage || showUpdatedMessage) router.replace("/friends");
  }, [showCreatedMessage, showUpdatedMessage, router, showToast]);

  /**
   * Foto reale di un amico collegato a un account Hinthial, quando non
   * ne ha caricata una a mano (quella vince sempre, v.
   * domain/friends/types, FriendListItem.avatarPath) --- una chiamata a
   * parte per amico (v. get_linked_friend_avatar_path), best-effort e
   * silenziosa come checkLinkedAccounts qui sotto: un fallimento lascia
   * semplicemente le iniziali colorate al posto della foto.
   */
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
   * FASE A del piano di condivisione capsule: per ogni amico non ancora
   * collegato a un account (`linkedUserId` nullo), verifica se la sua
   * email corrisponde a un account Hinthial registrato --- così se un
   * amico si registra dopo essere stato aggiunto, ce ne si accorge al
   * prossimo caricamento della pagina, senza dover fare nulla apposta.
   * Best-effort e silenzioso: un fallimento (rete, tetto giornaliero di
   * verifiche) non deve disturbare la pagina, si riprova al prossimo
   * refresh. Sequenziale, non in parallelo, per restare gentile col
   * tetto giornaliero lato server.
   *
   * Trovato un collegamento, sincronizza anche retroattivamente (FASE B)
   * le capsule già condivise con questo amico prima che avesse un
   * account --- altrimenti resterebbero per sempre invisibili in
   * "Condivise con me" solo perché il collegamento è arrivato in
   * ritardo (esattamente il caso che ha motivato la Fase A). `capsules`
   * è già in memoria da refresh(), nessuna nuova decrittazione. Anche la
   * foto reale (v. resolveLinkedAvatar) si risolve qui: subito per chi
   * era già collegato, appena dopo per chi si collega ora per la prima
   * volta.
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

      const [friendsResult, capsulesResult, incoming, outgoingFriend, outgoingGuardian] = await Promise.all([
        listFriends(supabase, masterKey),
        listCapsules(supabase, masterKey),
        listIncomingFriendRequests(supabase, user.id),
        listOutgoingPendingFriendRequests(supabase, user.id),
        listOutgoingPendingGuardianRoleRequests(supabase, user.id),
      ]);
      setFriends(friendsResult);
      setCapsules(capsulesResult);
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

  /**
   * "Chiedi di diventare guardiano" (isGuardian passa a true solo dopo
   * l'accettazione, v. domain/friends/guardian-requests) oppure "Rimuovi
   * dai guardiani" (nessun consenso richiesto per togliere, v.
   * revokeGuardianRole) --- solo un AMICO può ricevere la prima.
   */
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
        showToast("Richiesta di diventare guardiano inviata --- diventerà guardiano solo se accetta.");
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

  function sortValueFor(friend: FriendListItem, column: SortColumn): string {
    switch (column) {
      case "name":
        return friend.name;
      case "email":
        return friend.email;
      case "role":
        return friend.role;
      case "status":
        return STATUS_LABEL[friend.status];
      case "capsules":
        return String(capsulesFor(friend).length);
    }
  }

  function handleSort(column: SortColumn) {
    setSort((prev) => toggleSort(prev, column));
  }

  const filteredFriends = friends
    .filter((friend) => {
      const normalized = query.trim().toLowerCase();
      if (!normalized) return true;
      return [friend.name, friend.email, friend.role].join(" ").toLowerCase().includes(normalized);
    })
    .filter((friend) => statusFilter === "all" || friend.status === statusFilter);

  // Solo la vista a tabella si ordina --- l'elenco resta cronologico.
  const sortedFriends = applySort(filteredFriends, sort, sortValueFor);

  // Si riclampa invece di resettare con un effect: se un filtro riduce i
  // risultati, la pagina torna da sola entro il range valido.
  const pageCount = Math.max(1, Math.ceil(filteredFriends.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedFriends = sortedFriends.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  );

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

  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="min-w-0 w-full sm:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">
            Amici
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Persone che potranno essere autorizzate in futuro ad accedere ai tuoi dati. Ogni nuovo
            contatto resta una PERSONA privata finché non richiede e accetta l&apos;amicizia con
            l&apos;altro account Hinthial --- solo un AMICO può diventare guardiano.{" "}
            <Link href="/friends/protected" className="font-medium text-brand hover:underline">
              Vedi chi proteggi
            </Link>
            .
          </p>
        </div>
        <Link
          href="/friends/new"
          className="hidden shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover sm:block"
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
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun amico ancora. Aggiungine uno col tasto qui sopra.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Cerca per nome, email o ruolo…" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FriendStatus | "all")}
              aria-label="Filtra per stato"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            >
              <option value="all">Tutti</option>
              <option value="active">Attivi</option>
              <option value="revoked">Revocati</option>
            </select>
            <ListViewToggle section="friends" hideOnMobile />
          </div>

          {filteredFriends.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessun amico corrisponde alla ricerca.
            </p>
          ) : viewMode === "table" ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <SortableColumnHeader label="Nome" sortKey="name" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Email" sortKey="email" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Ruolo" sortKey="role" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader label="Stato" sortKey="status" sort={sort} onSort={handleSort} />
                      <SortableColumnHeader
                        label="Capsule"
                        sortKey="capsules"
                        sort={sort}
                        onSort={handleSort}
                      />
                      <th className="p-3">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {pagedFriends.map((friend) => {
                      const busy = busyId === friend.id;

                      return (
                        <tr key={friend.id}>
                          <td className="max-w-[12rem] p-3 font-medium text-zinc-900 dark:text-zinc-100">
                            <div className="flex items-center gap-2">
                              <Avatar
                                firstName={friend.firstName}
                                lastName={friend.lastName}
                                avatarUrl={avatarUrlFor(friend)}
                                seed={friend.id}
                                size="sm"
                                linked={friend.linkedUserId !== null}
                              />
                              <span className="truncate">{friend.name}</span>
                            </div>
                          </td>
                          <td className="max-w-[14rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {friend.email}
                          </td>
                          <td className="max-w-[10rem] truncate p-3 text-zinc-600 dark:text-zinc-400">
                            {friend.role}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[friend.status]}`}
                              >
                                {STATUS_LABEL[friend.status]}
                              </span>
                              <FriendBadge isFriend={friend.isFriend} />
                              <GuardianBadge isGuardian={friend.isGuardian} />
                              {isFriendRequestPending(friend) ? (
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                                  Amicizia in attesa
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {capsulesFor(friend).length}
                          </td>
                          <td className="p-3">
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
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {filteredFriends.map((friend) => {
                const busy = busyId === friend.id;

                return (
                  <li key={friend.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar
                        firstName={friend.firstName}
                        lastName={friend.lastName}
                        avatarUrl={avatarUrlFor(friend)}
                        seed={friend.id}
                        linked={friend.linkedUserId !== null}
                      />
                      <div className="min-w-0">
                      {/* div, non p: la nuvoletta di CapsulesBadge contiene <ul>/<li>, non ammessi dentro un <p>. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {friend.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[friend.status]}`}
                        >
                          {STATUS_LABEL[friend.status]}
                        </span>
                        <FriendBadge isFriend={friend.isFriend} />
                        <GuardianBadge isGuardian={friend.isGuardian} />
                        {isFriendRequestPending(friend) ? (
                          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                            Amicizia in attesa
                          </span>
                        ) : null}
                        <CapsulesBadge capsules={capsulesFor(friend)} />
                      </div>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {friend.email} · {friend.role} · dal {formatDate(friend.createdAt)}
                      </p>
                      </div>
                    </div>
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
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
