"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  acceptFriendRequest,
  listIncomingFriendRequests,
  rejectFriendRequest,
  type IncomingFriendRequest,
} from "@/domain/friends/friend-requests";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Avvisa in Dashboard di una richiesta di amicizia in arrivo --- v.
 * richiesta utente: "manda email + popup al destinatario". Una alla
 * volta, in coda, come SharedCapsuleNotificationPopup: qui però si
 * accetta o rifiuta direttamente dal popup, non solo "ho capito", perché
 * serve una vera decisione, non solo una presa visione. Non ha bisogno
 * di dismissedAt lato server (a differenza delle capsule condivise):
 * accettare o rifiutare risolve già la richiesta, che smette di
 * comparire da sola al giro successivo.
 */
export function FriendRequestNotificationPopup({ masterKey }: { masterKey: CryptoKey }) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [queue, setQueue] = useState<IncomingFriendRequest[] | null>(null);
  const [busy, setBusy] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setQueue([]);
          return;
        }
        if (!cancelled) setUserId(user.id);
        const incoming = await listIncomingFriendRequests(supabase, user.id);
        if (!cancelled) setQueue(incoming);
      } catch {
        // Silenzioso --- un popup di cortesia non deve mai bloccare la dashboard.
        if (!cancelled) setQueue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const currentRequest = queue?.[0] ?? null;
  const { mounted, entered } = useMountedTransition(currentRequest !== null, 150);

  async function handleAccept() {
    if (!currentRequest || !userId) return;
    setBusy(true);
    try {
      await acceptFriendRequest(supabase, masterKey, userId, currentRequest);
      showToast(`Ora sei amico di ${currentRequest.senderName}.`);
    } catch {
      showToast("Non è stato possibile accettare la richiesta --- riprova da Amici.");
    } finally {
      setQueue((prev) => (prev ? prev.slice(1) : prev));
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!currentRequest) return;
    setBusy(true);
    try {
      await rejectFriendRequest(supabase, currentRequest.id);
    } catch {
      // Non bloccante --- ricomparirà al prossimo caricamento, non è grave.
    } finally {
      setQueue((prev) => (prev ? prev.slice(1) : prev));
      setBusy(false);
    }
  }

  if (!mounted || !currentRequest) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150",
        entered ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuova richiesta di amicizia"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand">🤝 Una richiesta di amicizia</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <strong>{currentRequest.senderName}</strong> vorrebbe diventare tuo amico su Hinthial. Se
            accetti, comparirete entrambi nella rispettiva lista amici.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Rifiuta
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleAccept}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
}
