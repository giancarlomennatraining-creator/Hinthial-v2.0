"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { UnlockPhase } from "@/components/crypto/unlock/useUnlockFlow";

/**
 * Le tre "cornici" della finestra: l'immagine (il lucchetto, la porta della cassaforte, l'anello) con le sue animazioni
 * e un posto per il contenuto. Le usano sia lo sblocco (v. GlassSkin, VaultSkin, FingerprintSkin) sia la creazione
 * della master password (v. SetupDialog): le animazioni di errore e di uscita sono quindi le stesse.
 */

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

export function GlassFrame({ phase, wide, children }: { phase: UnlockPhase; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? "unlock-glass unlock-wide" : "unlock-glass"} data-phase={phase}>
      <LockGlyph />
      {children}
    </div>
  );
}

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
  return { cx: 100 + 91 * Math.cos(radians), cy: 100 + 91 * Math.sin(radians), degrees };
});

/** La cassaforte: la porta con la ruota (`length` = quanti caratteri sono stati scritti) e, sotto, il pannello col contenuto. */
export function VaultFrame({
  phase,
  length,
  wide,
  children,
}: {
  phase: UnlockPhase;
  length: number;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "unlock-vault-wrap unlock-wide" : "unlock-vault-wrap"} data-phase={phase}>
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
      <div className="unlock-vault-panel">{children}</div>
    </div>
  );
}

const FINGERPRINT_PATHS =
  "M12 3a8 8 0 0 0-8 8v1M12 3a8 8 0 0 1 8 8v3M7.5 20c.5-1.6.9-3 .9-5a3.6 3.6 0 0 1 7.2 0c0 2.5.3 4.2 1.2 6M12 15c0 2.6-.4 4.5-1.2 6.5M4 15.5c0 1.6-.2 3-.8 4.5M20 17.5c0 .9-.1 1.8-.3 2.7";
const LOCK_PATHS = "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4";

/** L'anello: un pulsante (con `onClick`) per l'impronta, altrimenti solo un'immagine con il lucchetto. */
export function FingerprintRing({
  fingerprint,
  onClick,
  disabled,
}: {
  fingerprint: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className="unlock-fp-spin" />
      <span className="unlock-fp-sweep" />
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={fingerprint ? FINGERPRINT_PATHS : LOCK_PATHS} />
      </svg>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className="unlock-fp"
        aria-label="Sblocca con impronta/Face ID"
        disabled={disabled}
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="unlock-fp" aria-hidden="true">
      {inner}
    </div>
  );
}

/** L'anello con, sotto, il contenuto su un pannello di vetro (per la creazione della master password, che ha molto testo). */
export function FingerprintFrame({ phase, wide, children }: { phase: UnlockPhase; wide?: boolean; children: ReactNode }) {
  // Lo stato del cassetto non serve qui: il contenuto è sempre a vista.
  const [open] = useState(true);
  return (
    <div className={wide ? "unlock-fp-wrap unlock-wide" : "unlock-fp-wrap"} data-phase={phase} data-open={open}>
      <FingerprintRing fingerprint={false} />
      <div className="unlock-fp-panel">{children}</div>
    </div>
  );
}
