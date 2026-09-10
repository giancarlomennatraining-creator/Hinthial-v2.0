"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { SidePanel } from "@/components/ui/SidePanel";
import { listAuditEvents } from "@/domain/audit/repository";
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_CATEGORY_LABEL,
  AUDIT_EVENT_TYPE_CATEGORY,
  AUDIT_EVENT_TYPE_ICON,
  AUDIT_EVENT_TYPE_LABEL,
  type AuditEventCategory,
} from "@/domain/audit/labels";
import type { AuditEventType } from "@/lib/audit/log-event";
import type { AuditEventListItem } from "@/domain/audit/types";

const LOGIN_METHOD_LABEL: Record<string, string> = {
  password: "Password",
  totp: "App authenticator (TOTP)",
  backup_code: "Codice di backup",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * Impostazioni -> Attività: il registro tecnico scritto ad ogni
 * accesso/tentativo fallito/attivazione o rimozione dell'MFA/contenuto
 * creato o eliminato (v. lib/audit/log-event.ts), interrogabile invece
 * che caricato tutto insieme --- data inizio, data fine e categoria
 * (scelta multipla), poi "Trova". Un click su una riga apre il dettaglio
 * (metodo di login, IP, dispositivo/browser, quando presenti) in un
 * pannello laterale. Solo il tipo di evento e metadati tecnici --- mai un
 * nome file o di contatto: restano privati anche da questa vista, come
 * richiede lo zero-knowledge (v. AUDIT_EVENT_TYPE_LABEL). Non richiede la
 * master key sbloccata: è un log puramente tecnico, in chiaro come le
 * altre preferenze di profilo.
 */
export function AuditLogPanel() {
  const supabase = useRef(createClient()).current;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<AuditEventCategory>>(new Set());

  const [events, setEvents] = useState<AuditEventListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // `selected` non torna mai a null da sola (v. sotto) --- solo `panelOpen`
  // decide se il pannello è aperto, così il contenuto resta quello
  // dell'ultimo evento scelto per tutta la durata dell'animazione di
  // uscita (v. richiesta utente), invece di sparire di scatto insieme
  // allo stato che chiude il pannello.
  const [selected, setSelected] = useState<AuditEventListItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  function openDetail(event: AuditEventListItem) {
    setSelected(event);
    setPanelOpen(true);
  }

  function typesForSelectedCategories(): AuditEventType[] {
    if (selectedCategories.size === 0) return [];
    return (Object.keys(AUDIT_EVENT_TYPE_CATEGORY) as AuditEventType[]).filter((type) =>
      selectedCategories.has(AUDIT_EVENT_TYPE_CATEGORY[type]),
    );
  }

  async function handleSearch() {
    setError(null);
    setLoading(true);
    try {
      const results = await listAuditEvents(supabase, {
        startDate: startDate || null,
        endDate: endDate || null,
        types: typesForSelectedCategories(),
      });
      setEvents(results);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il registro attività.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Attività</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Cosa è successo sul tuo account e quando --- i dettagli di ogni contenuto restano
          privati, qui vedi solo il tipo di evento. Imposta i filtri e premi Trova.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="auditStartDate" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Data inizio
            </label>
            <input
              id="auditStartDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="auditEndDate" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Data fine
            </label>
            <input
              id="auditEndDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleSearch}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {loading ? "Ricerca…" : "Trova"}
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Tipo di attività (nessuna selezione = tutte)
          </p>
          <div role="group" aria-label="Filtra per tipo" className="flex flex-wrap gap-3">
            {AUDIT_EVENT_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={selectedCategories.has(category)}
                  onChange={() => setSelectedCategories((prev) => toggleInSet(prev, category))}
                />
                {AUDIT_EVENT_CATEGORY_LABEL[category]}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {!searched ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Imposta i filtri che ti interessano (o lasciali vuoti per tutto) e premi Trova.
          </p>
        </div>
      ) : events && events.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna attività trovata con questi filtri.
          </p>
        </div>
      ) : events ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Attività
                </th>
                <th scope="col" className="p-3 font-medium">
                  Quando
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {events.map((event) => (
                <tr
                  key={event.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => openDetail(event)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(event);
                    }
                  }}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <td className="flex items-center gap-2 p-3 text-zinc-700 dark:text-zinc-300">
                    <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[event.type]}</span>
                    {AUDIT_EVENT_TYPE_LABEL[event.type]}
                  </td>
                  <td className="p-3 text-zinc-500 dark:text-zinc-400">{formatDateTime(event.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} label="Dettaglio attività">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[selected.type]}</span>{" "}
                {AUDIT_EVENT_TYPE_LABEL[selected.type]}
              </h3>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Chiudi"
                className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <dl className="flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Quando</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">{formatDateTime(selected.createdAt)}</dd>
              </div>
              {selected.metadata?.method ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Metodo</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">
                    {LOGIN_METHOD_LABEL[selected.metadata.method] ?? selected.metadata.method}
                  </dd>
                </div>
              ) : null}
              {selected.metadata?.ip ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Indirizzo IP</dt>
                  <dd className="text-zinc-800 dark:text-zinc-200">{selected.metadata.ip}</dd>
                </div>
              ) : null}
              {selected.metadata?.userAgent ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Dispositivo/browser
                  </dt>
                  <dd className="break-words text-zinc-800 dark:text-zinc-200">
                    {selected.metadata.userAgent}
                  </dd>
                </div>
              ) : null}
              {!selected.metadata?.method && !selected.metadata?.ip && !selected.metadata?.userAgent ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Nessun altro dettaglio disponibile per questo evento.
                </p>
              ) : null}
            </dl>
          </>
        ) : null}
      </SidePanel>
    </div>
  );
}
