"use client";

import type { ReactNode } from "react";
import { FingerprintIcon } from "@/components/icons/nav-icons";
import { GlassFrame } from "@/components/crypto/unlock/frames";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

function subtitle(flow: UnlockFlow): string {
  if (flow.phase === "verifying") return "Verifica in corso…";
  if (flow.phase === "success") return "Cassaforte aperta.";
  return flow.recovery
    ? "Inserisci la tua recovery key."
    : "Inserisci la tua master password per accedere ai documenti.";
}

/** La pelle "Vetro": una lastra di vetro sfocata con una luce colorata dietro, e un lucchetto che si apre. */
export function GlassSkin({
  flow,
  dismiss,
  pairing,
}: {
  flow: UnlockFlow;
  dismiss?: () => void;
  pairing: ReactNode;
}) {
  const busy = flow.phase === "verifying" || flow.phase === "success";
  return (
    <GlassFrame phase={flow.phase}>
      <div>
        <h2>Sblocca</h2>
        <p className="unlock-sub" aria-live="polite">
          {subtitle(flow)}
        </p>
      </div>
      <UnlockForm flow={flow} />
      {flow.deviceLock ? (
        <>
          <div className="unlock-or">oppure</div>
          <button type="button" className="unlock-ghost" onClick={() => void flow.biometric()} disabled={busy}>
            <FingerprintIcon width={16} height={16} />
            Sblocca con impronta/Face ID
          </button>
        </>
      ) : null}
      <button type="button" className="unlock-link" onClick={flow.toggleRecovery}>
        {flow.recovery ? "Usa invece la master password" : "Hai perso la password? Usa la recovery key"}
      </button>
      {pairing}
      {dismiss ? (
        <button type="button" className="unlock-link" onClick={dismiss}>
          Più tardi
        </button>
      ) : null}
    </GlassFrame>
  );
}
