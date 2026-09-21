"use client";

import { useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { FingerprintIcon, SecurityIcon, UnlockedIcon } from "@/components/icons/nav-icons";
import { DevicePairingUnlock } from "@/components/crypto/DevicePairingUnlock";
import { cn } from "@/lib/utils";

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
  // Vero solo mentre aspettiamo la cerimonia WebAuthn --- accende
  // l'anello che ruota attorno al medaglione (v. globals.css,
  // .unlock-scanner). Distinto da `busy`, che resta condiviso con
  // l'invio della password: qui l'animazione ha senso solo per
  // l'attesa biometrica, non per un submit qualunque. Non esiste uno
  // stato "riuscito" da mostrare: se unlockWithDeviceLock() risolve,
  // RequireMasterKey smonta questo form nello stesso istante, prima
  // che un fotogramma di successo abbia modo di essere dipinto.
  const [scanning, setScanning] = useState(false);

  async function handleDeviceLockUnlock() {
    setDeviceLockAttempted(true);
    setError(null);
    setBusy(true);
    setScanning(true);
    try {
      await unlockWithDeviceLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sblocco non riuscito. Usa la master password.");
    } finally {
      setBusy(false);
      setScanning(false);
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
    <div className="mx-auto mt-6 flex max-w-sm flex-col items-center gap-6 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(23,31,60,0.05),0_20px_44px_-22px_rgba(23,31,60,0.22)] dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(43,79,196,0.14),transparent_72%)]",
          scanning && "unlock-scanner",
        )}
      >
        {scanning ? (
          <FingerprintIcon width={34} height={34} className="unlock-scanner-icon text-brand" />
        ) : (
          <SecurityIcon width={34} height={34} className="text-brand" />
        )}
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-brand">Sblocca</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {scanning
            ? "Verifica in corso…"
            : useRecoveryKey
              ? "Inserisci la tua recovery key."
              : "Inserisci la tua master password per accedere ai documenti."}
        </p>
      </div>

      {deviceLockAvailable && !deviceLockAttempted ? (
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={handleDeviceLockUnlock}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-brand px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/5 disabled:opacity-50 dark:hover:bg-brand/10"
          >
            <FingerprintIcon width={16} height={16} />
            {busy ? "Sblocco…" : "Sblocca con impronta/Face ID"}
          </button>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">oppure, con la master password</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left">
        {useRecoveryKey ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recoveryKey" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Recovery key
            </label>
            <input
              id="recoveryKey"
              name="recoveryKey"
              type="text"
              autoComplete="off"
              placeholder="XXXX-XXXX-XXXX-…"
              required
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="masterPassword"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Master password
            </label>
            <input
              id="masterPassword"
              name="masterPassword"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none focus:border-brand focus:ring-1 focus:ring-brand dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          <UnlockedIcon width={16} height={16} />
          {busy ? "Sblocco…" : "Sblocca"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2">
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
            stesso dispositivo se era GIÀ fidato in precedenza. Resta un
            blocco a parte (non in riga con il link sopra): da aperto
            mostra un QR code intero, che romperebbe una riga di link
            compatta. */}
        <DevicePairingUnlock />
      </div>
    </div>
  );
}
