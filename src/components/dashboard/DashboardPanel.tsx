"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangleIcon, CheckCircleIcon } from "@/components/icons/nav-icons";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { LoginSplash } from "@/components/dashboard/LoginSplash";
import { useLoginSplash } from "@/components/layout/LoginSplashProvider";
import { SharedCapsuleNotificationPopup } from "@/components/dashboard/SharedCapsuleNotificationPopup";
import { FriendRequestNotificationPopup } from "@/components/dashboard/FriendRequestNotificationPopup";
import { PageHelp } from "@/components/help/PageHelp";
import { PendingGuardianChecks } from "@/components/digital-legacy/PendingGuardianChecks";
import { rememberUnlockDismissed, unlockWasDismissed, useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { BTN_PRIMARY, PANEL_FLAT } from "@/components/ui/styles";
import { LoadingText } from "@/components/ui/LoadingText";

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
  const { requestUnlock, requestSetup, releaseUnlock, settling } = useUnlockPrompt();

  // "?justLoggedIn=1" arriva da signIn/signUp/verifyMfaCode (v. auth/actions.ts) --- letto una sola volta
  // all'apertura (v. LoginSplashProvider, che tiene lo stato del benvenuto), poi subito tolto dall'URL: un refresh o un
  // ritorno alla Dashboard più tardi non lo rivede più.
  const { active: showSplash, finish: finishSplash } = useLoginSplash();
  useEffect(() => {
    if (searchParams.get("justLoggedIn") === "1") router.replace("/dashboard");
  }, [searchParams, router]);

  // Con la cassaforte bloccata la finestra di sblocco compare subito sopra la dashboard sfocata; si può chiudere.
  // Chiusa con "Più tardi", sotto non resta lo scheletro: sembrerebbe un caricamento che non finisce mai.
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const dismissUnlock = useCallback(() => {
    rememberUnlockDismissed();
    setUnlockDismissed(true);
  }, []);
  useEffect(() => {
    if (status.kind !== "locked") return;
    // Mentre il logo si riempie la finestra non compare: partirebbe insieme a lui. Si apre a benvenuto finito.
    if (showSplash) return;
    if (unlockWasDismissed()) {
      // sessionStorage si legge solo nel browser: qui, non nello stato iniziale (eviterebbe l'idratazione).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnlockDismissed(true);
    } else {
      requestUnlock({ dismissible: true, onDismiss: dismissUnlock });
    }
  }, [status.kind, showSplash, requestUnlock, dismissUnlock]);

  // Lasciando la dashboard con la finestra ancora aperta, questa non resta sopra un'altra pagina.
  useEffect(() => () => releaseUnlock(), [releaseUnlock]);

  return (
    <div className="flex flex-col gap-6">
      {showSplash ? <LoginSplash onDone={finishSplash} /> : null}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-title">
            Ciao, {displayName}
          </h1>
          <PageHelp
            title="Oggi"
            tips={[
              { icon: "💞", text: "La continuità dice quanto Hinthial è pronto a far arrivare ciò che sai e ciò che hai a chi ami, se un giorno non ci sei." },
              { icon: "💌", text: "Qui vedi le capsule che ti aspettano, quelle che si aprono presto e le bozze da chiudere." },
              { icon: "⏰", text: "Le scadenze più vicine, o già passate, arrivano qui per prime." },
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

      {/* Chi ti ha scelto come guardiano e aspetta una risposta: prima di tutto, e senza bisogno della master password. */}
      <PendingGuardianChecks />

      {status.kind === "unlocked" && !settling ? (
        <>
          <SharedCapsuleNotificationPopup />
          <FriendRequestNotificationPopup masterKey={status.masterKey} />
          <DashboardWidgets masterKey={status.masterKey} />
        </>
      ) : status.kind === "checking" ? (
        <LoadingText />
      ) : status.kind === "locked" || status.kind === "unlocked" ? (
        <div className="flex flex-col gap-4">
          {/* Con la finestra che si sta dissolvendo dopo lo sblocco la dashboard resta uno scheletro: si popola a fine animazione. */}
          {status.kind === "locked" ? (
            <div className={`${PANEL_FLAT} flex flex-wrap items-center gap-3 p-4`}>
              <p className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                La cassaforte è bloccata: sblocca per vedere le tue scadenze e il tuo archivio recente.
              </p>
              <button
                type="button"
                onClick={() => {
                  setUnlockDismissed(false);
                  requestUnlock({ dismissible: true, onDismiss: dismissUnlock });
                }}
                className={BTN_PRIMARY}
              >
                Sblocca ora
              </button>
            </div>
          ) : null}
          {/* Lo scheletro dà alla finestra di sblocco qualcosa da sfocare dietro: è la forma della dashboard che arriverà. */}
          {status.kind === "locked" && unlockDismissed ? null : (
            <div aria-hidden="true">
              <DashboardSkeleton />
            </div>
          )}
        </div>
      ) : (
        <div className={`${PANEL_FLAT} flex flex-wrap items-center gap-3 p-4`}>
          <p className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            Crea la tua master password per iniziare a usare Hinthial: è un minuto.
          </p>
          <button
            type="button"
            onClick={() => requestSetup({ dismissible: true })}
            className={BTN_PRIMARY}
          >
            Crea la master password
          </button>
        </div>
      )}
    </div>
  );
}
