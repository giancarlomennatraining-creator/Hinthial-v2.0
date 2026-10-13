"use client";

import { useState, type ReactNode } from "react";
import type { UnlockPhase } from "@/components/crypto/unlock/useUnlockFlow";

/**
 * Le due "cornici" della finestra: l'immagine (il lucchetto, l'anello) con le sue animazioni
 * e un posto per il contenuto. Le usano sia lo sblocco (v. GlassSkin, FingerprintSkin) sia la creazione
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

/**
 * Un testo che cambia (es. "Inserisci la tua master password…" → "Verifica in corso…") senza che la finestra cambi altezza:
 * tutte le versioni stanno sovrapposte nella stessa cella, ne è visibile una sola, e la cella è alta quanto la più lunga.
 */
export function StableText({ texts, active }: { texts: string[]; active: number }) {
  return (
    <span className="grid">
      {texts.map((text, i) => (
        <span key={text} style={{ gridArea: "1 / 1" }} className={i === active ? undefined : "invisible"} aria-hidden={i === active ? undefined : true}>
          {text}
        </span>
      ))}
    </span>
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
