"use client";

import { useState, type ReactNode } from "react";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

const FINGERPRINT_PATHS =
  "M12 3a8 8 0 0 0-8 8v1M12 3a8 8 0 0 1 8 8v3M7.5 20c.5-1.6.9-3 .9-5a3.6 3.6 0 0 1 7.2 0c0 2.5.3 4.2 1.2 6M12 15c0 2.6-.4 4.5-1.2 6.5M4 15.5c0 1.6-.2 3-.8 4.5M20 17.5c0 .9-.1 1.8-.3 2.7";
const LOCK_PATHS = "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4";

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

  const ring = (
    <>
      <span className="unlock-fp-spin" />
      <span className="unlock-fp-sweep" />
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={flow.deviceLock ? FINGERPRINT_PATHS : LOCK_PATHS} />
      </svg>
    </>
  );

  return (
    <div className="unlock-fp-wrap" data-phase={flow.phase} data-open={open}>
      {flow.deviceLock ? (
        <button
          type="button"
          className="unlock-fp"
          aria-label="Sblocca con impronta/Face ID"
          disabled={busy}
          onClick={() => void flow.biometric()}
        >
          {ring}
        </button>
      ) : (
        <div className="unlock-fp" aria-hidden="true">
          {ring}
        </div>
      )}

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
