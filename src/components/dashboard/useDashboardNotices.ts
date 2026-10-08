"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { SummaryContext } from "@/domain/ai/types";
import { loadPendingProposals, type PendingProposals } from "@/domain/dashboard/proposals";
import {
  acceptFriendRequest,
  listIncomingFriendRequests,
  rejectFriendRequest,
  type IncomingFriendRequest,
} from "@/domain/friends/friend-requests";
import { getLocalUserId } from "@/lib/auth/local-user";

/**
 * Le proposte di Hinthia da rivedere: si calcolano dopo il primo disegno della dashboard, senza farla aspettare.
 * `null` finché non sono pronte o se non ce n'è nessuna.
 */
export function usePendingProposals(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
  context: SummaryContext,
  now: Date,
): PendingProposals | null {
  const [pending, setPending] = useState<PendingProposals | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPendingProposals(supabase, masterKey, context, now)
      .then((result) => {
        if (!cancelled) setPending(result.proposals > 0 ? result : null);
      })
      .catch(() => {
        // Un avviso in più: se non si calcola, la dashboard resta com'è.
      });
    return () => {
      cancelled = true;
    };
    // Una volta sola per apertura: il contesto cambia a ogni "segna fatta", ma le proposte no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, masterKey]);

  return pending;
}

export interface FriendRequestsState {
  requests: IncomingFriendRequest[];
  busyId: string | null;
  /** Il nome di chi si è appena accettato, per un messaggio; null se l'ultima azione non era un'accettazione. */
  accept: (request: IncomingFriendRequest) => Promise<string | null>;
  reject: (request: IncomingFriendRequest) => Promise<void>;
}

/** Le richieste di amicizia in arrivo, con accetta e rifiuta: le stesse azioni del popup, per le dashboard che le mostrano da sé. */
export function useIncomingFriendRequests(
  supabase: SupabaseClient<Database>,
  masterKey: CryptoKey,
): FriendRequestsState {
  const [requests, setRequests] = useState<IncomingFriendRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getLocalUserId(supabase);
        if (!id || cancelled) return;
        setUserId(id);
        const incoming = await listIncomingFriendRequests(supabase, id);
        if (!cancelled) setRequests(incoming);
      } catch {
        // Silenzioso, come il popup: un avviso di cortesia non deve bloccare la dashboard.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const accept = useCallback(
    async (request: IncomingFriendRequest) => {
      if (!userId) return null;
      setBusyId(request.id);
      try {
        await acceptFriendRequest(supabase, masterKey, userId, request);
        return request.senderName;
      } catch {
        return null;
      } finally {
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        setBusyId(null);
      }
    },
    [supabase, masterKey, userId],
  );

  const reject = useCallback(
    async (request: IncomingFriendRequest) => {
      setBusyId(request.id);
      try {
        await rejectFriendRequest(supabase, request.id);
      } catch {
        // Non bloccante: ricomparirà al prossimo caricamento.
      } finally {
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        setBusyId(null);
      }
    },
    [supabase],
  );

  return { requests, busyId, accept, reject };
}
