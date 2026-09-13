"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getCapsuleCountdownVisible, updateCapsuleCountdownVisible } from "@/domain/profile/repository";
import { cn } from "@/lib/utils";

/**
 * Impostazioni -> Aspetto: mostra/nasconde il countdown a cartellini
 * delle capsule (v. CapsuleCountdown.tsx) --- autonomo, non un
 * Provider/context come nav_orientation: è letto solo qui e da
 * CapsulesPanel, due alberi di componenti indipendenti che non hanno
 * bisogno di restare sincronizzati in tempo reale tra loro.
 */
export function CapsuleCountdownSettings() {
  const [supabase] = useState(() => createClient());
  const [visible, setVisible] = useState(true);
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
        const result = await getCapsuleCountdownVisible(supabase, user.id);
        if (!cancelled) setVisible(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleChange(next: boolean) {
    setError(false);
    setBusy(true);
    const previous = visible;
    setVisible(next); // optimistic: l'interruttore risponde subito
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await updateCapsuleCountdownVisible(supabase, user.id, next);
    } catch {
      setVisible(previous);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Countdown verso l&apos;apertura delle capsule
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          I cartellini con giorni/ore/minuti/secondi mancanti, in elenco, in tabella e
          nell&apos;anteprima di ogni capsula chiusa o condivisa.
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
            Preferenza non salvata.
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={visible}
        aria-label="Mostra il countdown delle capsule"
        disabled={busy || loading}
        onClick={() => handleChange(!visible)}
        className={cn(
          "shrink-0 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50",
          visible
            ? "bg-brand text-white hover:bg-brand-hover"
            : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900",
        )}
      >
        {visible ? "Mostrato" : "Nascosto"}
      </button>
    </div>
  );
}
