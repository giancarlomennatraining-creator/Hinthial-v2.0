"use client";

import { useCallback, useState } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";

/** Dove si trova lo sblocco, per le animazioni: a riposo, mentre si scrive, in verifica, sbagliato, riuscito. */
export type UnlockPhase = "idle" | "typing" | "verifying" | "error" | "success";

export interface UnlockFlow {
  phase: UnlockPhase;
  error: string | null;
  /** Si sta usando la recovery key al posto della master password. */
  recovery: boolean;
  /** Si può sbloccare con impronta o Face ID (in anteprima sempre, per farla vedere). */
  deviceLock: boolean;
  /** Anteprima dalle Impostazioni: niente sblocco vero, riesce con qualunque testo. */
  demo: boolean;
  toggleRecovery: () => void;
  /** Chiamata mentre si scrive: toglie l'errore e porta lo stato a "mentre si scrive". */
  touch: () => void;
  submit: (secret: string) => Promise<void>;
  biometric: () => Promise<void>;
}

const DEMO_PASSWORD_MS = 700;
const DEMO_BIOMETRIC_MS = 1300;

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function messageOf(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  return err.message.includes("Decryption") ? "Non corretta. Riprova." : err.message;
}

/**
 * Tutta la logica dello sblocco, uguale per le tre pelli (v. UnlockDialog): password, recovery key, impronta. Le pelli
 * mostrano solo `phase` ed `error`. Se il vault si sblocca per un'altra strada mentre la finestra è aperta (il
 * collegamento via QR da un altro dispositivo) lo stato diventa "riuscito" da solo.
 */
export function useUnlockFlow(demo: boolean): UnlockFlow {
  const { status, unlockWithPassword, unlockWithRecoveryKey, deviceLockAvailable, unlockWithDeviceLock } =
    useMasterKey();
  const [phase, setPhase] = useState<UnlockPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  const unlockedElsewhere = !demo && status.kind === "unlocked";
  const effectivePhase: UnlockPhase = unlockedElsewhere ? "success" : phase;
  const locked = effectivePhase === "verifying" || effectivePhase === "success";

  const submit = useCallback(
    async (secret: string) => {
      if (locked) return;
      setError(null);
      setPhase("verifying");
      try {
        if (demo) {
          await wait(DEMO_PASSWORD_MS);
          if (!secret.trim()) throw new Error("Scrivi qualcosa per provare.");
        } else if (recovery) {
          await unlockWithRecoveryKey(secret);
        } else {
          await unlockWithPassword(secret);
        }
        setPhase("success");
      } catch (err) {
        setPhase("error");
        setError(messageOf(err, "Si è verificato un errore. Riprova."));
      }
    },
    [locked, demo, recovery, unlockWithPassword, unlockWithRecoveryKey],
  );

  const biometric = useCallback(async () => {
    if (locked) return;
    setError(null);
    setPhase("verifying");
    try {
      if (demo) await wait(DEMO_BIOMETRIC_MS);
      else await unlockWithDeviceLock();
      setPhase("success");
    } catch (err) {
      setPhase("error");
      setError(messageOf(err, "Sblocco non riuscito. Usa la master password."));
    }
  }, [locked, demo, unlockWithDeviceLock]);

  const touch = useCallback(() => {
    setError(null);
    setPhase((p) => (p === "idle" || p === "error" || p === "typing" ? "typing" : p));
  }, []);

  const toggleRecovery = useCallback(() => {
    setRecovery((r) => !r);
    setError(null);
    setPhase((p) => (p === "verifying" || p === "success" ? p : "idle"));
  }, []);

  return {
    phase: effectivePhase,
    error,
    recovery,
    deviceLock: demo || deviceLockAvailable,
    demo,
    toggleRecovery,
    touch,
    submit,
    biometric,
  };
}
