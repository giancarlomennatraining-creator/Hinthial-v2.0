"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getTrashRetentionDays, updateTrashRetentionDays } from "@/domain/profile/repository";

/** Le uniche opzioni previste (v. richiesta utente) --- non un numero libero, stessa disciplina di digital_legacy_preset. */
const TRASH_RETENTION_DAYS_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

/**
 * Impostazioni -> Aspetto: per quanti giorni un documento eliminato
 * resta nel Cestino prima di essere rimosso per sempre --- stesso
 * pattern autonomo di CapsuleCountdownSettings (letto solo qui e da
 * chi sposta un documento nel cestino, DocumentsPanel.tsx, non un
 * Provider condiviso).
 */
export function TrashRetentionSettings() {
  const [supabase] = useState(() => createClient());
  const [days, setDays] = useState(15);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const result = await getTrashRetentionDays(supabase, user.id);
        if (!cancelled) setDays(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleChange(next: number) {
    setError(false);
    setBusy(true);
    const previous = days;
    setDays(next); // ottimistico: la select risponde subito
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await updateTrashRetentionDays(supabase, user.id, next);
    } catch {
      setDays(previous);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">🗑️ Cestino</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Un documento eliminato resta recuperabile per questo periodo, poi viene rimosso per
          sempre. Cambiarlo non modifica la scadenza dei documenti già nel cestino.
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            Preferenza non salvata.
          </p>
        ) : null}
      </div>
      <select
        value={days}
        disabled={busy || loading}
        onChange={(e) => handleChange(Number(e.target.value))}
        aria-label="Giorni di conservazione nel cestino"
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      >
        {TRASH_RETENTION_DAYS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option} giorni
          </option>
        ))}
      </select>
    </div>
  );
}
