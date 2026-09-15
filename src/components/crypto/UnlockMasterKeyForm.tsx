"use client";

import { useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";
import { UnlockedIcon } from "@/components/icons/nav-icons";
import { DevicePairingUnlock } from "@/components/crypto/DevicePairingUnlock";

export function UnlockMasterKeyForm() {
  const { unlockWithPassword, unlockWithRecoveryKey, deviceLockAvailable, unlockWithDeviceLock } =
    useMasterKey();
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // FASE 13: tentato una volta sola, all'apertura di questa schermata,
  // non a ogni render --- se l'utente annulla la cerimonia biometrica
  // (o sceglie "usa la password" prima che il browser gliela mostri),
  // il campo password resta comunque la via di sempre.
  const [deviceLockAttempted, setDeviceLockAttempted] = useState(false);

  async function handleDeviceLockUnlock() {
    setDeviceLockAttempted(true);
    setError(null);
    setBusy(true);
    try {
      await unlockWithDeviceLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sblocco non riuscito. Usa la master password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    setBusy(true);
    try {
      if (useRecoveryKey) {
        await unlockWithRecoveryKey(String(formData.get("recoveryKey") ?? ""));
      } else {
        await unlockWithPassword(String(formData.get("masterPassword") ?? ""));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Decryption")
            ? "Non corretta. Riprova."
            : err.message
          : "Si è verificato un errore. Riprova.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-brand">Sblocca</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {useRecoveryKey
            ? "Inserisci la tua recovery key."
            : "Inserisci la tua master password per accedere ai documenti."}
        </p>
      </div>

      {deviceLockAvailable && !deviceLockAttempted ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Questo dispositivo è fidato --- puoi sbloccare con l&apos;impronta o Face ID, senza
            digitare la master password.
          </p>
          <button
            type="button"
            onClick={handleDeviceLockUnlock}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Sblocco…" : "Sblocca con impronta/Face ID"}
          </button>
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">oppure, con la master password</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {useRecoveryKey ? (
          <TextField
            id="recoveryKey"
            name="recoveryKey"
            label="Recovery key"
            type="text"
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX-…"
            required
          />
        ) : (
          <TextField
            id="masterPassword"
            name="masterPassword"
            label="Master password"
            type="password"
            autoComplete="current-password"
            required
          />
        )}

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          <UnlockedIcon width={16} height={16} />
          {busy ? "Sblocco…" : "Sblocca"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setUseRecoveryKey((v) => !v);
          setError(null);
        }}
        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        {useRecoveryKey ? "Usa invece la master password" : "Hai perso la password? Usa la recovery key"}
      </button>

      {/* FASE 13, terzo passo --- sbloccare QUESTO dispositivo (non
          ancora fidato) facendolo approvare da uno che lo è già, via QR
          code: v. DevicePairingUnlock.tsx. Indipendente dall'opzione
          "impronta/Face ID" qui sopra, che riguarda invece QUESTO
          stesso dispositivo se era GIÀ fidato in precedenza. */}
      <DevicePairingUnlock />
    </div>
  );
}
