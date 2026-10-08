"use client";

import { DevicePairingUnlock } from "@/components/crypto/DevicePairingUnlock";
import { DialogShell } from "@/components/crypto/DialogShell";
import { FingerprintSkin } from "@/components/crypto/unlock/FingerprintSkin";
import { GlassSkin } from "@/components/crypto/unlock/GlassSkin";
import { VaultSkin } from "@/components/crypto/unlock/VaultSkin";
import { useUnlockFlow } from "@/components/crypto/unlock/useUnlockFlow";
import type { UnlockStyle } from "@/lib/unlock-style";

/**
 * La finestra di sblocco della master key: il guscio (v. DialogShell) con una delle tre pelli (v. lib/unlock-style.ts).
 * Resta montata durante l'animazione di uscita, anche se il vault è già sbloccato, e chiama `onDone` quando ha finito.
 * Con `dismissible` si può chiudere (Esc o "Più tardi"). In `demo` non sblocca nulla: serve a provare le pelli dalle
 * Impostazioni.
 */
export function UnlockDialog({
  style,
  dismissible,
  demo,
  leaveHref,
  onDismiss,
  onDone,
}: {
  style: UnlockStyle;
  dismissible: boolean;
  demo: boolean;
  leaveHref?: string;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const flow = useUnlockFlow(demo);
  const success = flow.phase === "success";
  const dismiss = dismissible && !success ? onDismiss : undefined;
  const pairing = demo ? null : (
    <div className="unlock-pairing">
      <DevicePairingUnlock />
    </div>
  );

  return (
    <DialogShell
      style={style}
      phase={flow.phase}
      dismissible={dismissible}
      label="Sblocca la cassaforte"
      leaveHref={leaveHref}
      onDismiss={onDismiss}
      onDone={onDone}
    >
      {demo ? (
        <p className="unlock-demo" role="status">
          Anteprima: scrivi quello che vuoi, non sblocca nulla
        </p>
      ) : null}
      {style === "vault" ? (
        <VaultSkin flow={flow} dismiss={dismiss} pairing={pairing} />
      ) : style === "fingerprint" ? (
        <FingerprintSkin flow={flow} dismiss={dismiss} pairing={pairing} />
      ) : (
        <GlassSkin flow={flow} dismiss={dismiss} pairing={pairing} />
      )}
    </DialogShell>
  );
}
