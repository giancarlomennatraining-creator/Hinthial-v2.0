"use client";

import { useState, type ReactNode } from "react";
import { VaultFrame } from "@/components/crypto/unlock/frames";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

/**
 * La pelle "Cassaforte": la porta di una cassaforte con la ruota che gira a ogni carattere. Se si sbaglia la porta
 * vibra e la spia diventa rossa; se è giusta i chiavistelli rientrano, la maniglia gira e la porta si apre piano, poi
 * tutto sfuma mentre la sfocatura si dissolve (v. unlock.css: nessuno stacco netto).
 */
export function VaultSkin({
  flow,
  dismiss,
  pairing,
}: {
  flow: UnlockFlow;
  dismiss?: () => void;
  pairing: ReactNode;
}) {
  const [length, setLength] = useState(0);
  const busy = flow.phase === "verifying" || flow.phase === "success";

  return (
    <VaultFrame phase={flow.phase} length={length}>
      <h2>Sblocca</h2>
      <UnlockForm flow={flow} onLengthChange={setLength} />
      <div className="unlock-row">
        {flow.deviceLock ? (
          <button type="button" className="unlock-link" onClick={() => void flow.biometric()} disabled={busy}>
            Sblocca con impronta/Face ID
          </button>
        ) : null}
        <button type="button" className="unlock-link" onClick={flow.toggleRecovery}>
          {flow.recovery ? "Usa la master password" : "Recovery key"}
        </button>
      </div>
      {pairing}
      {dismiss ? (
        <button type="button" className="unlock-link" onClick={dismiss}>
          Più tardi
        </button>
      ) : null}
    </VaultFrame>
  );
}
