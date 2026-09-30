"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons/nav-icons";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { LoginSplash } from "@/components/dashboard/LoginSplash";
import { SharedCapsuleNotificationPopup } from "@/components/dashboard/SharedCapsuleNotificationPopup";
import { FriendRequestNotificationPopup } from "@/components/dashboard/FriendRequestNotificationPopup";
import { PageHelp } from "@/components/help/PageHelp";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // "?justLoggedIn=1" arriva da signIn/signUp/verifyMfaCode (v. auth/actions.ts) --- letto una sola volta
  // all'apertura, poi subito tolto dall'URL: un refresh o un ritorno alla Dashboard più tardi non lo rivede più.
  const [showSplash, setShowSplash] = useState(() => searchParams.get("justLoggedIn") === "1");
  useEffect(() => {
    if (showSplash) router.replace("/dashboard");
  }, [showSplash, router]);

  return (
    <div className="flex flex-col gap-6">
      {showSplash ? <LoginSplash onDone={() => setShowSplash(false)} /> : null}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-brand">
            Ciao, {displayName}
          </h1>
          <PageHelp
            title="Dashboard"
            tips={[
              { icon: "📊", text: "I riquadri in alto contano cosa hai in ogni sezione, aggiornati in tempo reale." },
              { icon: "⏰", text: "Le scadenze più vicine e i documenti aggiunti di recente arrivano qui per primi." },
              { icon: "🔒", text: "Serve la master password sbloccata per vedere i dettagli cifrati — il resto resta comunque visibile." },
            ]}
          />
        </div>
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
