"use client";

import { useEffect, useState } from "react";

/**
 * "Oggi: 12 richieste a Hinthia su 300." Sotto il cancello generale, solo se Hinthia è attiva: così il tetto (v.
 * lib/ai/daily-quota.ts) non arriva come una sorpresa. Se la lettura non riesce non mostra nulla.
 */
export function AIDailyUsage() {
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/ai/usage");
        if (!response.ok) return;
        const data = (await response.json()) as { used?: unknown; limit?: unknown };
        if (!cancelled && typeof data.used === "number" && typeof data.limit === "number") {
          setUsage({ used: data.used, limit: data.limit });
        }
      } catch {
        // Un'informazione in più: senza, il pannello funziona lo stesso.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage) return null;
  const reached = usage.used >= usage.limit;

  return (
    <p role="status" aria-label="Richieste a Hinthia di oggi" className="text-xs text-zinc-500 dark:text-zinc-400">
      Oggi: <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{usage.used}</span> richieste a
      Hinthia su <span className="tabular-nums">{usage.limit}</span> al giorno.
      {reached ? " Hai raggiunto il tetto: Hinthia riprende domani." : " Leggere un documento lungo ne usa più d'una."}
    </p>
  );
}
