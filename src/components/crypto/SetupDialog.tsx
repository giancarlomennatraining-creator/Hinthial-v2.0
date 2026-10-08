"use client";

import { useState } from "react";
import { DialogShell } from "@/components/crypto/DialogShell";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { SetupMasterKeyForm, type SetupFormState } from "@/components/crypto/SetupMasterKeyForm";
import { FingerprintFrame, GlassFrame, VaultFrame } from "@/components/crypto/unlock/frames";
import type { UnlockPhase } from "@/components/crypto/unlock/useUnlockFlow";
import type { UnlockStyle } from "@/lib/unlock-style";

/**
 * La finestra di creazione della master password: stesso guscio e stessa cornice dello sblocco (v. DialogShell e
 * frames), con dentro i due passi della creazione (v. SetupMasterKeyForm). Quando la creazione finisce il vault risulta
 * sbloccato e la finestra fa la stessa animazione di uscita dello sblocco. Si può chiudere (`dismissible`) solo al
 * primo passo: al secondo c'è una recovery key appena generata che non si può riavere.
 */
export function SetupDialog({
  style,
  dismissible,
  leaveHref,
  onDismiss,
  onDone,
}: {
  style: UnlockStyle;
  dismissible: boolean;
  leaveHref?: string;
  onDismiss: () => void;
  onDone: () => void;
}) {
  const { status } = useMasterKey();
  const [form, setForm] = useState<SetupFormState>({ step: 1, busy: false });

  const phase: UnlockPhase =
    status.kind === "unlocked" ? "success" : form.busy ? "verifying" : form.step === 2 ? "typing" : "idle";
  const canDismiss = dismissible && form.step === 1 && phase !== "success";

  const content = (
    <>
      <SetupMasterKeyForm onStateChange={setForm} />
      {canDismiss ? (
        <button type="button" className="unlock-link" onClick={onDismiss}>
          Più tardi
        </button>
      ) : null}
    </>
  );

  return (
    <DialogShell
      style={style}
      phase={phase}
      dismissible={canDismiss}
      label="Crea la master password"
      leaveHref={leaveHref}
      onDismiss={onDismiss}
      onDone={onDone}
    >
      {style === "vault" ? (
        <VaultFrame phase={phase} length={0} wide>
          {content}
        </VaultFrame>
      ) : style === "fingerprint" ? (
        <FingerprintFrame phase={phase} wide>
          {content}
        </FingerprintFrame>
      ) : (
        <GlassFrame phase={phase} wide>
          {content}
        </GlassFrame>
      )}
    </DialogShell>
  );
}
