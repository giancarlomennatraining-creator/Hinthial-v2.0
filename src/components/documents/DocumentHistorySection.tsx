"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listDocumentAuditEvents } from "@/domain/audit/repository";
import { summarizeDocumentHistory } from "@/domain/audit/document-history";
import {
  AUDIT_EVENT_TYPE_ICON,
  describeAuditEvent,
} from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";

const MAX_ROWS = 15;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Le ultime azioni fatte su questo contenuto, dal registro eventi (v. domain/audit): solo tipo di azione e data,
 * mai nomi o valori. `version` cambia quando il documento si ricarica dopo un'azione, e fa rileggere l'elenco.
 */
export function DocumentHistorySection({
  documentId,
  version,
  fieldLabels,
}: {
  documentId: string;
  version: unknown;
  /** Etichette leggibili dei campi liberi, per dire quale campo riguardava una proposta. */
  fieldLabels: Record<string, string>;
}) {
  const [events, setEvents] = useState<AuditEventListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDocumentAuditEvents(createClient(), documentId)
      .then((rows) => {
        if (cancelled) return;
        setEvents(summarizeDocumentHistory(rows, MAX_ROWS));
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, version]);

  return (
    <section aria-label="Cronologia" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Cronologia
      </h2>

      {failed ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Non riesco a caricare la cronologia.
        </p>
      ) : events === null ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Carico…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nessuna azione registrata per questo contenuto.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Attività
                </th>
                <th scope="col" className="p-3 font-medium">
                  Dettaglio
                </th>
                <th scope="col" className="p-3 font-medium">
                  Quando
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {events.map((event) => {
                const { label, detail } = describeAuditEvent(
                  event,
                  fieldLabels,
                );
                return (
                  <tr key={event.id}>
                    <td className="p-3 text-zinc-700 dark:text-zinc-300">
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">
                          {AUDIT_EVENT_TYPE_ICON[event.type]}
                        </span>
                        {label}
                      </span>
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      {detail ?? "—"}
                    </td>
                    <td className="whitespace-nowrap p-3 text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(event.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
