"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
 * Le ultime azioni fatte su questo contenuto, dal registro Attività (v. domain/audit): solo tipo di azione e data,
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Cronologia
        </h2>
        <Link
          href="/settings?tab=activity"
          className="text-xs font-medium text-brand underline-offset-2 hover:underline"
        >
          Vedi tutto
        </Link>
      </div>

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
        <ol className="flex flex-col gap-1.5">
          {events.map((event) => {
            const { label, detail } = describeAuditEvent(event, fieldLabels);
            return (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-baseline gap-2 text-zinc-800 dark:text-zinc-200">
                  <span aria-hidden="true">
                    {AUDIT_EVENT_TYPE_ICON[event.type]}
                  </span>
                  <span className="min-w-0">
                    {label}
                    {detail ? (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {" "}
                        · {detail}
                      </span>
                    ) : null}
                  </span>
                </span>
                <time
                  dateTime={event.createdAt}
                  className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  {formatDateTime(event.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
