"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { formatSize } from "@/lib/format";
import { getMyStorageUsage, type StorageUsage } from "@/lib/storage/quota";
import { cn } from "@/lib/utils";

/**
 * Quanto spazio occupano i tuoi file cifrati, sul tetto per utente (v. lib/storage/quota.ts). In Impostazioni e nel
 * Cestino, dove lo spazio si libera: `refreshKey` cambia quando qualcosa viene eliminato, e la barra si aggiorna.
 * Se lo spazio non si riesce a leggere non mostra nulla.
 */
export function StorageUsageMeter({ refreshKey = 0 }: { refreshKey?: number }) {
  const supabase = useSupabase();
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getMyStorageUsage(supabase);
      if (!cancelled) setUsage(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, refreshKey]);

  if (!usage) return null;
  const ratio = usage.quotaBytes > 0 ? Math.min(1, usage.usedBytes / usage.quotaBytes) : 0;
  const full = usage.usedBytes >= usage.quotaBytes;
  const nearlyFull = !full && ratio >= 0.9;

  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Spazio usato</span>
        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
          {formatSize(usage.usedBytes)} di {formatSize(usage.quotaBytes)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Spazio usato"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className={cn("h-full rounded-full", full ? "bg-red-600" : nearlyFull ? "bg-amber-500" : "bg-brand")}
          style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%` }}
        />
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {full
          ? "Hai finito lo spazio: non puoi caricare altri file. Svuota il Cestino o elimina i contenuti che non ti servono più."
          : nearlyFull
            ? "Lo spazio sta per finire. Svuotare il Cestino lo libera subito."
            : "Conta i file cifrati: documenti, allegati delle capsule, copie dei fascicoli condivisi e foto del profilo."}
      </p>
    </div>
  );
}
