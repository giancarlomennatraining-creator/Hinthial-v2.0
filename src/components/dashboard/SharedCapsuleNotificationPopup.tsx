"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  listCapsulesSharedWithMe,
  dismissCapsuleShareNotification,
} from "@/domain/capsules/repository";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";
import type { SharedCapsuleListItem } from "@/domain/capsules/types";

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

/**
 * Avvisa in Dashboard di una capsula appena condivisa con l'utente ---
 * v. richiesta utente: resta visibile finché non la chiude, poi mai più
 * per QUELLA capsula (v. dismissCapsuleShareNotification, un campo
 * server-side, non solo un dismiss locale --- sopravvive a un refresh
 * o a un altro dispositivo). Più di una capsula non ancora vista si
 * mostra una alla volta, in coda: chiudere la prima fa comparire la
 * successiva, non tutte insieme.
 */
export function SharedCapsuleNotificationPopup() {
  const [supabase] = useState(() => createClient());
  const [queue, setQueue] = useState<SharedCapsuleListItem[] | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shared = await listCapsulesSharedWithMe(supabase);
        const undismissed = shared.filter((s) => s.dismissedAt === null);
        if (!cancelled) setQueue(undismissed);
      } catch {
        // Silenzioso --- un popup di cortesia non deve mai bloccare la
        // dashboard se il caricamento fallisce.
        if (!cancelled) setQueue([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const currentShare = queue?.[0] ?? null;
  const { mounted, entered } = useMountedTransition(currentShare !== null, 150);

  async function handleDismiss() {
    if (!currentShare) return;
    setDismissing(true);
    try {
      await dismissCapsuleShareNotification(supabase, currentShare.id);
    } catch {
      // Anche se la scrittura fallisce, non blocchiamo l'utente qui ---
      // ricomparirà al prossimo caricamento della dashboard, non è grave.
    } finally {
      setQueue((prev) => (prev ? prev.slice(1) : prev));
      setDismissing(false);
    }
  }

  if (!mounted || !currentShare) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-150",
        entered ? "opacity-100" : "opacity-0",
      )}
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuova capsula condivisa"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div>
          <h2 className="text-lg font-semibold text-brand">📦 Una nuova capsula per te</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <strong>{currentShare.ownerName}</strong> ha condiviso con te una capsula
            {currentShare.openAt ? (
              <>
                {" "}
                --- si aprirà il <strong>{formatDateTime(currentShare.openAt)}</strong>
              </>
            ) : null}
            .
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            La trovi in Capsule, scheda &quot;Condivise con me&quot;.
          </p>
        </div>

        <button
          type="button"
          disabled={dismissing}
          onClick={handleDismiss}
          className="self-end rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Ho capito
        </button>
      </div>
    </div>
  );
}
