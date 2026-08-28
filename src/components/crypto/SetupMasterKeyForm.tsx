"use client";

import { useState, type FormEvent } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { TextField } from "@/components/ui/TextField";
import type { MasterKeySetup } from "@/lib/crypto";

type PendingSetup = { setup: MasterKeySetup; masterKey: CryptoKey };

export function SetupMasterKeyForm() {
  const { setup, confirmSetup } = useMasterKey();
  const [pending, setPending] = useState<PendingSetup | null>(null);
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("masterPassword") ?? "");
    const confirmPassword = String(formData.get("confirmMasterPassword") ?? "");

    if (password.length < 8) {
      setError("La master password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setBusy(true);
    try {
      const result = await setup(password);
      setPending(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setError(null);
    setBusy(true);
    try {
      await confirmSetup(pending.setup, pending.masterKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            Salva la tua recovery key
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Se dimentichi la master password, solo questa recovery key potrà
            farti recuperare i tuoi documenti. HINTHIAL non la conserva da
            nessuna parte: viene mostrata una sola volta, adesso.
          </p>
        </div>

        <code className="break-all rounded-md bg-zinc-100 p-4 text-center text-sm font-mono text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
          {pending.setup.recoveryKey.formatted}
        </code>

        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmedSaved}
            onChange={(e) => setConfirmedSaved(e.target.checked)}
          />
          Ho salvato la recovery key in un posto sicuro.
        </label>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!confirmedSaved || busy}
          onClick={handleConfirm}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Attendere…" : "Continua"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          Configura la cifratura
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Crea una master password per proteggere i tuoi documenti. È
          diversa dalla password del tuo account e non lascia mai questo
          dispositivo.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <TextField
          id="masterPassword"
          name="masterPassword"
          label="Master password"
          type="password"
          autoComplete="new-password"
          required
        />
        <TextField
          id="confirmMasterPassword"
          name="confirmMasterPassword"
          label="Conferma master password"
          type="password"
          autoComplete="new-password"
          required
        />

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
          {busy ? "Configurazione…" : "Crea"}
        </button>
      </form>
    </div>
  );
}
