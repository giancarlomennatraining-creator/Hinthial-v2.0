"use client";

import { useCallback, useState } from "react";
import {
  auditFiltersToParams,
  countActiveAuditFilters,
  parseAuditFilters,
  type AuditFilterParams,
  type AuditFilters,
} from "@/domain/audit/filters";
import type { AuditEventType } from "@/lib/audit/log-event";

/** I filtri del registro: nell'URL (si condividono, resistono al ricarica e al tasto indietro) e in questo stato. */
export function useAuditFilters(initialParams: AuditFilterParams) {
  const [filters, setFilters] = useState<AuditFilters>(() => parseAuditFilters(initialParams));

  const commit = useCallback((next: AuditFilters) => {
    setFilters(next);
    const params = new URLSearchParams({ tab: "security", section: "activity" });
    for (const [key, value] of auditFiltersToParams(next)) params.set(key, value);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  function change(patch: Partial<AuditFilters>) {
    commit({ ...filters, ...patch, page: 1 });
  }

  function toggleType(type: AuditEventType) {
    change({
      types: filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type],
    });
  }

  return { filters, commit, change, toggleType, activeFilters: countActiveAuditFilters(filters) };
}

export type AuditFiltersState = ReturnType<typeof useAuditFilters>;
