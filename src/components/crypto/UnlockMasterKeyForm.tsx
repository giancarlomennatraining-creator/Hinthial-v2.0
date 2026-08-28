"use client";

import { useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";

export function UnlockMasterKeyForm() {
  const { unlockWithPassword, unlockWithRecoveryKey } = useMasterKey();
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Sblocca</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {useRecoveryKey
            ? "Inserisci la tua recovery key."
            : "Inserisci la tua master password per accedere ai documenti."}
        </p>
      </div>

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
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
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
    </div>
  );
}
