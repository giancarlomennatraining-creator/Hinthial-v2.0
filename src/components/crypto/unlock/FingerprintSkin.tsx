"use client";

import { useState, type ReactNode } from "react";
import { FingerprintRing } from "@/components/crypto/unlock/frames";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

/**
 * La pelle "Impronta": un anello da toccare per sbloccare con impronta o Face ID; una linea lo scansiona e, al
 * riconoscimento, un'onda parte dal centro mentre la sfocatura si dissolve. La master password sta in un cassetto sotto.
 * Su un dispositivo senza impronta registrata l'anello non è un pulsante e il cassetto resta aperto: si vede solo la
 * password, come nelle altre pelli.
 */
export function FingerprintSkin({
  flow,
  dismiss,
  pairing,
}: {
  flow: UnlockFlow;
  dismiss?: () => void;
  pairing: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = drawerOpen || !flow.deviceLock;
  const busy = flow.phase === "verifying" || flow.phase === "success";

  return (
    <div className="unlock-fp-wrap" data-phase={flow.phase} data-open={open}>
      <FingerprintRing
        fingerprint={flow.deviceLock}
        onClick={flow.deviceLock ? () => void flow.biometric() : undefined}
        disabled={busy}
      />

      <div>
        <h2>Sblocca</h2>
        <p className="unlock-sub" aria-live="polite">
          {flow.phase === "verifying"
            ? "Verifica in corso…"
            : flow.phase === "success"
              ? "Riconosciuto."
              : flow.deviceLock
                ? "Tocca l'anello: impronta o Face ID di questo dispositivo."
                : "Inserisci la tua master password per accedere ai documenti."}
        </p>
      </div>

      {flow.error && !open ? (
        <p role="alert" className="unlock-err">
          {flow.error}
        </p>
      ) : null}

      {flow.deviceLock ? (
        <button type="button" className="unlock-link" aria-expanded={open} onClick={() => setDrawerOpen((v) => !v)}>
          {open ? "Nascondi la master password" : "Usa la master password"}
        </button>
      ) : null}

      <div className="unlock-fp-drawer" aria-hidden={!open}>
        <UnlockForm flow={flow} focusSignal={open} />
        <button type="button" className="unlock-link" onClick={flow.toggleRecovery}>
          {flow.recovery ? "Usa invece la master password" : "Hai perso la password? Usa la recovery key"}
        </button>
        {pairing}
      </div>

      {dismiss ? (
        <button type="button" className="unlock-link" onClick={dismiss}>
          Più tardi
        </button>
      ) : null}
    </div>
  );
}
