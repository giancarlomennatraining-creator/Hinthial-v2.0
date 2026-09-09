"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { deleteAccount } from "@/lib/account/actions";

const CONFIRM_PHRASE = "CANCELLA ACCOUNT";

/**
 * Cancellazione definitiva dell'account --- a differenza di
 * ResetAccountCard (che svuota il vault mantenendo l'account attivo),
 * qui sparisce anche l'account stesso: non si può più accedere con
 * queste credenziali. V. lib/account/actions.ts per cosa viene
 * esattamente eliminato (tutto: cascata da auth.users) e perché non
 * naviga da sé dopo il successo.
 *
 * Richiede di reinserire la master password prima di procedere (oltre
 * alla frase di conferma testuale) --- verificata riprovando a sbloccare
 * con `useMasterKey().unlockWithPassword`, l'unico modo per verificarla
 * davvero: zero-knowledge, il server non la vede mai. Non serve la
 * Master Key stessa (nessun dato da decifrare qui: Storage viene ripulito
 * per prefisso lato server, non per path scoperti decifrando).
 */
export function DeleteAccountCard() {
  const router = useRouter();
  const { unlockWithPassword } = useMasterKey();

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      try {
        await unlockWithPassword(masterPassword);
      } catch {
        throw new Error("Master password non corretta.");
      }

      await deleteAccount();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile completare la cancellazione.");
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div>
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          Cancella il tuo account
        </h2>
        <p className="mt-1 text-sm text-red-800/90 dark:text-red-400/90">
          Cancella per sempre il tuo account Hinthial e ogni dato ad esso collegato: non potrai
          più accedere con queste credenziali. A differenza di &quot;Reimposta l&apos;account&quot;,
          qui sparisce anche l&apos;account stesso, non solo il suo contenuto. Richiede la tua
          master password. L&apos;operazione non è reversibile, e riceverai un&apos;email di
          conferma.
        </p>
      </div>

      <button
        type="button"
        onClick={openModal}
        className="self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Cancella account
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Conferma cancellazione account"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Sei sicuro?</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Il tuo account e tutti i dati collegati verranno cancellati per sempre. Non si può
                annullare.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="delete-master-password"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Master password
              </label>
              <input
                id="delete-master-password"
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                autoComplete="current-password"
                disabled={busy}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="confirm-delete"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Scrivi <strong>{CONFIRM_PHRASE}</strong> per confermare
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                disabled={busy}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
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
                disabled={confirmText !== CONFIRM_PHRASE || !masterPassword || busy}
                onClick={handleConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Cancellazione…" : "Cancella definitivamente"}
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
