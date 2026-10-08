"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { UnlockForm } from "@/components/crypto/unlock/UnlockForm";
import type { UnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";

/** Quanti gradi gira la ruota per ogni carattere scritto. */
const DEGREES_PER_CHARACTER = 27;

const TICKS = Array.from({ length: 40 }, (_, i) => {
  const angle = (i * 9 * Math.PI) / 180;
  const inner = i % 5 === 0 ? 38 : 42;
  return {
    x1: 100 + inner * Math.sin(angle),
    y1: 100 - inner * Math.cos(angle),
    x2: 100 + 47 * Math.sin(angle),
    y2: 100 - 47 * Math.cos(angle),
  };
});

/** I quattro chiavistelli sul bordo della porta: rientrano quando si sblocca. */
const BOLTS = [0, 1, 2, 3].map((k) => {
  const degrees = -90 + k * 60 - 30;
  const radians = (degrees * Math.PI) / 180;
  const cx = 100 + 91 * Math.cos(radians);
  const cy = 100 + 91 * Math.sin(radians);
  return { cx, cy, degrees };
});

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
    <div className="unlock-vault-wrap" data-phase={flow.phase}>
      <div className="unlock-vault">
        <div className="unlock-vault-inside" />
        <div className="unlock-door">
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle className="u-ring" cx="100" cy="100" r="94" />
            <circle className="u-ring" cx="100" cy="100" r="70" />
            {BOLTS.map((bolt) => (
              <rect
                key={bolt.degrees}
                className="unlock-bolt"
                x={bolt.cx - 7}
                y={bolt.cy - 7}
                width="14"
                height="14"
                rx="3"
                transform={`rotate(${bolt.degrees} ${bolt.cx} ${bolt.cy})`}
              />
            ))}
            <g className="unlock-dial" style={{ "--dial": `${length * DEGREES_PER_CHARACTER}deg` } as CSSProperties}>
              <circle className="u-face" cx="100" cy="100" r="50" />
              {TICKS.map((tick, i) => (
                <line key={i} className="u-tick" x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
              ))}
              <circle className="u-mark" cx="100" cy="46" r="3.2" />
            </g>
            <g className="unlock-handle">
              <line x1="100" y1="100" x2="100" y2="68" />
              <line x1="100" y1="100" x2="132" y2="100" />
              <line x1="100" y1="100" x2="68" y2="100" />
              <line x1="100" y1="100" x2="100" y2="132" />
              <circle cx="100" cy="100" r="9" />
            </g>
          </svg>
          <span className="unlock-led" />
        </div>
      </div>

      <div className="unlock-vault-panel">
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
      </div>
    </div>
  );
}
