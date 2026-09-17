"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import {
  acceptGuardianRoleRequest,
  listIncomingGuardianRoleRequests,
  listMyProtected,
  rejectGuardianRoleRequest,
  resignAsGuardian,
  type IncomingGuardianRoleRequest,
  type ProtectedRelationship,
} from "@/domain/friends/guardian-requests";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "Protetti" --- il lato del GUARDIANO nel modello Amici v2 (v. richiesta
 * utente): chi ti ha chiesto di diventare il suo guardiano (in attesa di
 * una risposta) e chi proteggi già (richiesta accettata, con la
 * possibilità di dimettersi in qualunque momento). Nessun dato del vault
 * coinvolto --- solo nomi in chiaro e id, come GuardianVerificationPanel:
 * niente RequireMasterKey.
 */
export function ProtectedPanel() {
  const supabase = useRef(createClient()).current;
  const showToast = useToast();

  const [requests, setRequests] = useState<IncomingGuardianRoleRequest[]>([]);
  const [protectedList, setProtectedList] = useState<ProtectedRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione non valida.");

      const [incoming, protectedRows] = await Promise.all([
        listIncomingGuardianRoleRequests(supabase, user.id),
        listMyProtected(supabase, user.id),
      ]);
      setRequests(incoming);
      setProtectedList(protectedRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i protetti.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleAccept(request: IncomingGuardianRoleRequest) {
    setBusyId(request.id);
    setError(null);
    try {
      await acceptGuardianRoleRequest(supabase, request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast(`Ora sei guardiano di ${request.ownerName}.`);
      void refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile accettare la richiesta.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(request: IncomingGuardianRoleRequest) {
    setBusyId(request.id);
    setError(null);
    try {
      await rejectGuardianRoleRequest(supabase, request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      showToast("Richiesta rifiutata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rifiutare la richiesta.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResign(relationship: ProtectedRelationship) {
    if (!window.confirm(`Smettere di essere guardiano di ${relationship.ownerName}?`)) return;

    setBusyId(relationship.requestId);
    setError(null);
    try {
      await resignAsGuardian(supabase, relationship.requestId);
      setProtectedList((prev) => prev.filter((p) => p.requestId !== relationship.requestId));
      showToast("Non sei più guardiano.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile dimettersi.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">Protetti</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Le persone che ti hanno indicato come guardiano --- una persona di fiducia da contattare se
          un giorno non dovessero più poter accedere al proprio account.{" "}
          <Link href="/friends" className="font-medium text-brand hover:underline">
            Torna ad Amici
          </Link>
          .
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Richieste in attesa</h2>
            {requests.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna richiesta in attesa.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                {requests.map((request) => {
                  const busy = busyId === request.id;
                  return (
                    <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        <strong>{request.ownerName}</strong> ti ha chiesto di diventare suo guardiano ---
                        dal {formatDate(request.createdAt)}.
                      </span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAccept(request)}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                        >
                          Accetta
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReject(request)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                        >
                          Rifiuta
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chi proteggi</h2>
            {protectedList.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Non sei ancora guardiano di nessuno.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                {protectedList.map((relationship) => {
                  const busy = busyId === relationship.requestId;
                  return (
                    <li
                      key={relationship.requestId}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        🛡️ <strong>{relationship.ownerName}</strong>
                        {relationship.acceptedAt ? ` --- dal ${formatDate(relationship.acceptedAt)}` : ""}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleResign(relationship)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      >
                        Non essere più guardiano
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
