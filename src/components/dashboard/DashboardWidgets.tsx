"use client";

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TodayHome } from "@/components/dashboard/TodayHome";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { ErrorText } from "@/components/ui/ErrorText";

/** Il corpo di "Oggi" (v. TodayHome). */
export function DashboardWidgets({ masterKey }: { masterKey: CryptoKey }) {
  const { context, loading, error } = useDashboardData(masterKey);

  if (error) {
    return (
      <ErrorText>
        {error}
      </ErrorText>
    );
  }

  if (loading || !context) {
    return <DashboardSkeleton />;
  }

  return <TodayHome context={context} masterKey={masterKey} />;
}
