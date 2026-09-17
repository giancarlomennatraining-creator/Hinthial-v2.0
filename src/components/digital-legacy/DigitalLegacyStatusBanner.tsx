"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getDigitalLegacyStatus } from "@/domain/digital-legacy/repository";
import { describeDigitalLegacyStatus, type DigitalLegacyStatus } from "@/domain/digital-legacy/types";

/**
 * Cosa vede il proprietario del proprio processo di "Eredità digitale"
 * in corso --- niente qui se tutto è "normal" (v. richiesta utente,
 * uno dei due punti rimasti aperti insieme alla vista del guardiano,
 * non costruita in questo incremento): solo conteggi già in chiaro,
 * mai i nomi dei guardiani (cifrati, visibili solo dalla propria
 * rubrica Amici).
 */
export function DigitalLegacyStatusBanner({ userId, reminderCount }: { userId: string; reminderCount: number }) {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<DigitalLegacyStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getDigitalLegacyStatus(supabase, userId);
        if (!cancelled) setStatus(loaded);
      } catch {
        // Silenzioso --- un banner informativo non deve mai bloccare il resto della scheda.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  if (!status || status.state === "normal") return null;

  const urgent = status.state === "final_wait" || status.state === "triggered";

  return (
    <div
      role="status"
      className={
        urgent
          ? "rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          : "rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
      }
    >
      {describeDigitalLegacyStatus(status, reminderCount)}
    </div>
  );
}
