"use client";

import { useState, type ReactNode } from "react";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { INPUT_FIELD } from "@/components/ui/styles";

/**
 * La scheda rossa di un'azione irreversibile sull'account (v. ResetAccountCard, DeleteAccountCard): un pulsante che
 * apre una finestra di conferma con la master password e una frase da scrivere. La master password è verificata
 * riprovando a sbloccare con `useMasterKey().unlockWithPassword`: zero-knowledge, il server non la vede mai.
 *
 * Dopo la conferma esegue `run`. Se `run` chiama `markDone` la finestra si chiude e, al posto del pulsante, compare
 * `doneMessage`; altrimenti (per es. si sta lasciando la pagina) resta occupata finché non si naviga via.
 */
export function DangerConfirmCard({
  title,
  description,
  triggerLabel,
  dialogLabel,
  dialogText,
  confirmPhrase,
  idPrefix,
  confirmLabel,
  busyLabel,
  fallbackError,
  doneMessage,
  run,
}: {
  title: string;
  description: ReactNode;
  triggerLabel: string;
  dialogLabel: string;
  dialogText: ReactNode;
  confirmPhrase: string;
  /** Prefisso degli id dei campi nella finestra, unico per scheda. */
  idPrefix: string;
  confirmLabel: string;
  busyLabel: string;
  fallbackError: string;
  doneMessage?: ReactNode;
  run: (markDone: () => void) => Promise<void>;
}) {
  const { unlockWithPassword } = useMasterKey();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function openModal() {
    setConfirmText("");
    setMasterPassword("");
    setError(null);
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    let finished = false;
    try {
      try {
        await unlockWithPassword(masterPassword);
      } catch {
        throw new Error("Master password non corretta.");
      }

      await run(() => {
        finished = true;
        setOpen(false);
        setDone(true);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
      setBusy(false);
      return;
    }
    // Con `markDone` l'operazione è finita qui; senza, si sta lasciando la pagina e resta occupata.
    if (finished) setBusy(false);
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div>
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">{title}</h2>
        <p className="mt-1 text-sm text-red-800/90 dark:text-red-400/90">{description}</p>
      </div>

      {done ? (
        doneMessage
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          {triggerLabel}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Sei sicuro?</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{dialogText}</p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${idPrefix}-master-password`}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Master password
              </label>
              <PasswordInput
                id={`${idPrefix}-master-password`}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                autoComplete="current-password"
                disabled={busy}
                className={`w-full ${INPUT_FIELD}`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={`confirm-${idPrefix}`}
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Scrivi <strong>{confirmPhrase}</strong> per confermare
              </label>
              <input
                id={`confirm-${idPrefix}`}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                disabled={busy}
                className={INPUT_FIELD}
              />
            </div>

            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={confirmText !== confirmPhrase || !masterPassword || busy}
                onClick={handleConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? busyLabel : confirmLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={closeModal}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
