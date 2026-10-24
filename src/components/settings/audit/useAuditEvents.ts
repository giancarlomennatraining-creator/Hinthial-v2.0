"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { listAuditEvents } from "@/domain/audit/repository";
import { auditFiltersToQuery, type AuditFilters } from "@/domain/audit/filters";
import type { AuditEventPage } from "@/domain/audit/types";
import { errorMessage } from "@/lib/utils";

/** La pagina di eventi per i filtri di adesso, impaginata dal server, caricata subito. */
export function useAuditEvents(
  supabase: SupabaseClient<Database>,
  filters: AuditFilters,
  commit: (next: AuditFilters) => void,
) {
  // Il risultato porta la chiave della richiesta che l'ha prodotto: "in caricamento" = la chiave non è ancora quella dei filtri attuali.
  const [result, setResult] = useState<{ key: string; data: AuditEventPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);

  const requestKey = JSON.stringify(auditFiltersToQuery(filters));

  useEffect(() => {
    let cancelled = false;
    const query = auditFiltersToQuery(filters);
    const key = JSON.stringify(query);
    listAuditEvents(supabase, query)
      .then((data) => {
        if (cancelled) return;
        setFailure(null);
        setResult({ key, data });
        // Una pagina oltre l'ultima (filtri più stretti, o un URL vecchio): si torna all'ultima che esiste.
        if (data.events.length === 0 && data.total > 0 && filters.page > 1) {
          commit({ ...filters, page: Math.ceil(data.total / filters.pageSize) });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure({ key, message: errorMessage(err, "Impossibile caricare il registro attività.") });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, filters, commit]);

  const total = result?.data.total ?? 0;

  return {
    result,
    loading: result?.key !== requestKey && failure?.key !== requestKey,
    error: failure?.key === requestKey ? failure.message : null,
    events: result?.data.events ?? [],
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
