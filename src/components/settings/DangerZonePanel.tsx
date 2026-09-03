"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { wipeVault } from "@/domain/danger-zone/repository";

const CONFIRM_PHRASE = "ELIMINA TUTTO";

/**
 * "Cancella tutto" --- irreversibile: v. domain/danger-zone/repository.ts
 * per cosa viene esattamente eliminato. Richiede la master key (per
 * scoprire i path in Storage da rimuovere), quindi il chiamante
 * (SettingsTabs) la fornisce già sbloccata via RequireMasterKey.
 */
export function DangerZonePanel({ userId, masterKey }: { userId: string; masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function openModal() {
    setConfirmText("");
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
      await wipeVault(supabase, masterKey, userId);
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile completare la cancellazione.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <div>
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Zona pericolosa</h2>
        <p className="mt-1 text-sm text-red-800/90 dark:text-red-400/90">
          Elimina per sempre Archivio, Asset, Contatti fiduciari e Capsule, e ripristina le
          categorie predefinite al posto di quelle personalizzate. Le Scadenze non vengono
          eliminate --- restano, solo scollegate da ciò che viene cancellato. L&apos;operazione non
          è reversibile.
        </p>
      </div>

      {done ? (
        <p className="text-sm font-medium text-red-700 dark:text-red-400">
          ✅ Tutti i dati sono stati eliminati. Le categorie predefinite sono di nuovo disponibili.
        </p>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className="self-start rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Cancella tutto
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
            aria-label="Conferma cancellazione totale"
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Sei sicuro?</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Archivio, Asset, Contatti fiduciari e Capsule verranno eliminati per sempre. Non
                si può annullare.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="confirm-wipe"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                Scrivi <strong>{CONFIRM_PHRASE}</strong> per confermare
              </label>
              <input
                id="confirm-wipe"
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
                disabled={confirmText !== CONFIRM_PHRASE || busy}
                onClick={handleConfirm}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? "Eliminazione…" : "Elimina definitivamente"}
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
