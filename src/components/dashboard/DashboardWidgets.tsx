"use client";

import { useState } from "react";
import { DashboardClassic } from "@/components/dashboard/DashboardClassic";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { DashboardToday } from "@/components/dashboard/DashboardToday";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import type { DashboardStyle } from "@/lib/dashboard-style";

/**
 * Il corpo della dashboard nello stile scelto in Impostazioni > Aspetto (v. lib/dashboard-style.ts). I dati sono gli
 * stessi per ogni stile (v. useDashboardData): cambia solo come si leggono.
 */
export function DashboardWidgets({ masterKey, style }: { masterKey: CryptoKey; style: DashboardStyle }) {
  const { supabase, context, loading, error, patchReminder } = useDashboardData(masterKey);
  // Letto una volta al mount (lazy initializer), non chiamando l'impuro Date.now() direttamente durante il render.
  const [now] = useState(() => new Date());

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (loading || !context) {
    return <DashboardSkeleton />;
  }

  if (style === "today") {
    return <DashboardToday supabase={supabase} masterKey={masterKey} context={context} now={now} patchReminder={patchReminder} />;
  }
  return <DashboardClassic context={context} />;
}
