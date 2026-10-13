"use client";

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TodayHome } from "@/components/dashboard/TodayHome";
import { useDashboardData } from "@/components/dashboard/useDashboardData";

/** Il corpo di "Oggi" (v. TodayHome). */
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

  return <TodayHome context={context} masterKey={masterKey} />;
}
