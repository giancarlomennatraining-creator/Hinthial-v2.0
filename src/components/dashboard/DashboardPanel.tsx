"use client";

import Link from "next/link";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons/nav-icons";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { SharedCapsuleNotificationPopup } from "@/components/dashboard/SharedCapsuleNotificationPopup";
import { FriendRequestNotificationPopup } from "@/components/dashboard/FriendRequestNotificationPopup";

/**
 * The greeting always renders, regardless of encryption status ---
 * only the widgets (which need to decrypt reminder/document data) are
 * gated, with a lightweight inline prompt rather than a full-page
 * takeover. A brand-new user (no encryption set up yet) or a returning
 * one after a refresh (locked) should still see "Ciao, ..." immediately.
 *
 * Niente checklist "Onboarding" qui (v. richiesta utente) --- resta
 * comunque consultabile dal gadget persistente nella barra laterale
 * (v. OnboardingStatus), che copre lo stesso scopo senza occupare corpo
 * della pagina.
 */
export function DashboardPanel({ displayName }: { displayName: string }) {
  const { status } = useMasterKey();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">
          Ciao, {displayName}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Questa è la tua dashboard: scadenze, documenti recenti e attività da
          completare.
        </p>
        {status.kind !== "checking" ? (
          <span
            className={
              status.kind === "not-set-up"
                ? "mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                : "mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400"
            }
          >
            {status.kind === "not-set-up" ? (
              <AlertTriangleIcon width={14} height={14} className="shrink-0" />
            ) : (
              <CheckCircleIcon width={14} height={14} className="shrink-0" />
            )}
            {status.kind === "not-set-up"
              ? "Master password non ancora creata"
              : "Master password creata · recovery key salvata"}
          </span>
        ) : null}
      </div>

      {status.kind === "unlocked" ? (
        <>
          <SharedCapsuleNotificationPopup />
          <FriendRequestNotificationPopup masterKey={status.masterKey} />
          <DashboardWidgets masterKey={status.masterKey} />
        </>
      ) : status.kind === "checking" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          {status.kind === "locked" ? (
            <>
              Sblocca la cifratura per vedere le tue scadenze e il tuo archivio recente:{" "}
              <Link href="/archive" className="font-medium text-brand hover:underline">
                vai all&apos;archivio
              </Link>
              .
            </>
          ) : (
            <>
              Crea la tua master password per iniziare a usare Hinthial:{" "}
              <Link href="/archive" className="font-medium text-brand hover:underline">
                vai all&apos;archivio
              </Link>
              .
            </>
          )}
        </p>
      )}
    </div>
  );
}
