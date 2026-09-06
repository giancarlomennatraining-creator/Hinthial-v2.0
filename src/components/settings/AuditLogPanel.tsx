"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listAuditEvents } from "@/domain/audit/repository";
import { groupAuditEventsByDay } from "@/domain/audit/group";
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_CATEGORY_LABEL,
  AUDIT_EVENT_TYPE_CATEGORY,
  AUDIT_EVENT_TYPE_ICON,
  AUDIT_EVENT_TYPE_LABEL,
  type AuditEventCategory,
} from "@/domain/audit/labels";
import { cn } from "@/lib/utils";
import type { AuditEventListItem } from "@/domain/audit/types";

type Filter = "all" | AuditEventCategory;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Impostazioni -> Attività: il registro tecnico già scritto ad ogni
 * accesso/contenuto aggiunto o eliminato/contatto aggiunto/vault
 * svuotato (v. lib/audit/log-event.ts), finora mai mostrato a chi lo
 * genera. Solo il tipo di evento e la data --- mai un nome file o di
 * contatto: restano privati anche da questa vista, come richiede lo
 * zero-knowledge (v. AUDIT_EVENT_TYPE_LABEL). Non richiede la master
 * key sbloccata: è un log puramente tecnico, in chiaro come le altre
 * preferenze di profilo --- consultabile anche prima di sbloccare la
 * cifratura.
 */
export function AuditLogPanel() {
  const supabase = useRef(createClient()).current;

  const [events, setEvents] = useState<AuditEventListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setEvents(await listAuditEvents(supabase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il registro attività.");
    }
  }, [supabase]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!events) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  const filtered =
    filter === "all" ? events : events.filter((e) => AUDIT_EVENT_TYPE_CATEGORY[e.type] === filter);
  const groups = groupAuditEventsByDay(filtered);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Attività</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cosa è successo sul tuo account e quando --- i dettagli di ogni contenuto restano
          privati, qui vedi solo il tipo di evento.
        </p>
      </div>

      <div role="radiogroup" aria-label="Filtra per tipo" className="flex flex-wrap gap-2">
        <button
          type="button"
          role="radio"
          aria-checked={filter === "all"}
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-brand text-white"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
          )}
        >
          Tutti
        </button>
        {AUDIT_EVENT_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={filter === category}
            onClick={() => setFilter(category)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              filter === category
                ? "bg-brand text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {AUDIT_EVENT_CATEGORY_LABEL[category]}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {filter === "all"
              ? "Nessuna attività registrata ancora."
              : "Nessuna attività di questo tipo."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {group.label}
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {group.events.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 p-3 text-sm">
                    <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[event.type]}</span>
                    <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                      {AUDIT_EVENT_TYPE_LABEL[event.type]}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatTime(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
