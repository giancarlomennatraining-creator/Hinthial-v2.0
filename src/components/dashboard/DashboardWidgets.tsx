"use client";

import { DashboardClassic } from "@/components/dashboard/DashboardClassic";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useDashboardData } from "@/components/dashboard/useDashboardData";

/** Il corpo della dashboard: contatori, prossime scadenze, aggiunti di recente (v. DashboardClassic). */
export function DashboardWidgets({ masterKey }: { masterKey: CryptoKey }) {
  const { context, loading, error } = useDashboardData(masterKey);

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

  return <DashboardClassic context={context} />;
}
