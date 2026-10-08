"use client";

import type { ReactNode } from "react";
import { FingerprintIcon } from "@/components/icons/nav-icons";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

/** Il lucchetto: il fermo si solleva mentre si scrive, diventa rosso e trema se si sbaglia, si apre quando riesce. */
function LockGlyph() {
  return (
    <svg className="unlock-lock" viewBox="0 0 92 106" aria-hidden="true">
      <path className="u-shackle" d="M26 48 V34 a20 20 0 0 1 40 0 V48" />
      <rect className="u-body" x="8" y="44" width="76" height="58" rx="16" />
      <circle className="u-hole" cx="46" cy="70" r="7" />
      <rect className="u-hole" x="43" y="72" width="6" height="14" rx="3" />
    </svg>
  );
}

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
    <div className="unlock-glass" data-phase={flow.phase}>
      <LockGlyph />
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
    </div>
  );
}
