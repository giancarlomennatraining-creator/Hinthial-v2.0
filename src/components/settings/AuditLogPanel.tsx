"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { SidePanel } from "@/components/ui/SidePanel";
import { Pagination } from "@/components/ui/Pagination";
import { listAuditEvents } from "@/domain/audit/repository";
import { listAuditElements, auditElementKey, type AuditElementOption } from "@/domain/audit/elements";
import { listFieldVocabulary } from "@/domain/structured-fields/vocabulary";
import { decryptAuditLabel } from "@/lib/audit/label";
import {
  AUDIT_ENTITY_TYPE_LABEL,
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_CATEGORY_LABEL,
  AUDIT_EVENT_TYPE_ICON,
  AUDIT_EVENT_TYPE_LABEL,
  auditEventTypesOf,
  describeAuditEvent,
  type AuditEventCategory,
} from "@/domain/audit/labels";
import {
  AUDIT_PAGE_SIZES,
  EMPTY_AUDIT_FILTERS,
  auditFiltersToParams,
  auditFiltersToQuery,
  countActiveAuditFilters,
  lastDaysRange,
  parseAuditFilters,
  typesWithinArea,
  type AuditFilterParams,
  type AuditFilters,
  type AuditPageSize,
} from "@/domain/audit/filters";
import type { AuditEntityType, AuditEventType } from "@/lib/audit/log-event";
import type { AuditEventListItem, AuditEventPage } from "@/domain/audit/types";

const LOGIN_METHOD_LABEL: Record<string, string> = {
  password: "Password",
  totp: "App authenticator (TOTP)",
  backup_code: "Codice di backup",
};

const FIELD_CLASS =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";
const LABEL_CLASS = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

const ENTITY_TYPES = Object.keys(AUDIT_ENTITY_TYPE_LABEL) as AuditEntityType[];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function periodLabel(from: string, to: string): string {
  if (from && to) return `Dal ${formatDay(from)} al ${formatDay(to)}`;
  return from ? `Dal ${formatDay(from)}` : `Fino al ${formatDay(to)}`;
}

function EventLabel({
  event,
  fieldLabels,
}: {
  event: AuditEventListItem;
  fieldLabels: Record<string, string>;
}) {
  const { label, detail } = describeAuditEvent(event, fieldLabels);
  return (
    <>
      {label}
      {detail ? <span className="text-zinc-500 dark:text-zinc-400"> · {detail}</span> : null}
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded-full bg-brand/10 py-1 pr-1 pl-3 text-xs font-medium text-brand">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Rimuovi filtro: ${label}`}
        className="rounded-full px-1.5 py-0.5 hover:bg-brand/20"
      >
        ✕
      </button>
    </li>
  );
}

/**
 * Impostazioni -> Attività: l'unico posto dove si consulta il registro eventi (v. lib/audit/log-event.ts). Filtri
 * nell'URL (si condividono, resistono al ricarica e al tasto indietro), elenco impaginato dal server, caricato subito.
 * Il registro contiene solo tipo di evento, metadati tecnici e il riferimento all'item (tipo + id): il nome
 * dell'elemento lo decifra il browser a vault sbloccato, oppure arriva dal titolo cifrato salvato nelle eliminazioni
 * definitive. A vault bloccato resta il solo tipo, e la pagina resta usabile.
 */
export function AuditLogPanel({ initialParams = {} }: { initialParams?: AuditFilterParams }) {
  const supabase = useState(() => createClient())[0];
  // Le schede di Impostazioni montano il pannello sia nel layout mobile sia in quello desktop: gli id non possono essere fissi.
  const uid = useId();
  const { status } = useMasterKey();
  const masterKey = status.kind === "unlocked" ? status.masterKey : null;

  const [filters, setFilters] = useState<AuditFilters>(() => parseAuditFilters(initialParams));
  // Il risultato porta la chiave della richiesta che l'ha prodotto: "in caricamento" = la chiave non è ancora quella dei filtri attuali.
  const [result, setResult] = useState<{ key: string; data: AuditEventPage } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [loadedElements, setLoadedElements] = useState<AuditElementOption[] | null>(null);
  const [deletedLabels, setDeletedLabels] = useState<Record<string, string>>({});
  // `selected` non torna mai a null da sola: solo `panelOpen` decide se il pannello è aperto, così il contenuto resta quello dell'ultimo evento durante l'animazione di uscita.
  const [selected, setSelected] = useState<AuditEventListItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const requestKey = JSON.stringify(auditFiltersToQuery(filters));

  const commit = useCallback((next: AuditFilters) => {
    setFilters(next);
    const params = new URLSearchParams({ tab: "activity" });
    for (const [key, value] of auditFiltersToParams(next)) params.set(key, value);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

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
        setFailure({ key, message: err instanceof Error ? err.message : "Impossibile caricare il registro attività." });
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, filters, commit]);

  useEffect(() => {
    let cancelled = false;
    listFieldVocabulary(supabase)
      .then((entries) => {
        if (!cancelled) setFieldLabels(Object.fromEntries(entries.map((entry) => [entry.fieldKey, entry.label])));
      })
      .catch(() => {
        // Senza vocabolario le proposte mostrano la chiave del campo: il registro resta leggibile.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!masterKey) return;
    let cancelled = false;
    listAuditElements(supabase, masterKey).then((options) => {
      if (!cancelled) setLoadedElements(options);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  const pageEvents = result?.data.events;
  useEffect(() => {
    if (!masterKey || !pageEvents) return;
    let cancelled = false;
    const withLabel = pageEvents.filter((event) => event.encryptedLabel);
    Promise.all(
      withLabel.map(async (event) => [event.id, await decryptAuditLabel(masterKey, event.encryptedLabel!)] as const),
    ).then((entries) => {
      if (cancelled) return;
      const decrypted = entries.filter((entry): entry is readonly [string, string] => entry[1] !== null);
      if (decrypted.length > 0) setDeletedLabels((prev) => ({ ...prev, ...Object.fromEntries(decrypted) }));
    });
    return () => {
      cancelled = true;
    };
  }, [masterKey, pageEvents]);

  // A vault bloccato non si mostra l'elenco rimasto in memoria da prima del blocco.
  const elements = masterKey ? loadedElements : null;
  const elementLabels = useMemo(
    () => new Map((elements ?? []).map((element) => [auditElementKey(element.type, element.id), element.label])),
    [elements],
  );

  function elementLabel(event: AuditEventListItem): string | null {
    if (!event.entityType || !event.entityId) return null;
    const typeLabel = AUDIT_ENTITY_TYPE_LABEL[event.entityType];
    const known = elementLabels.get(auditElementKey(event.entityType, event.entityId));
    if (known) return known;
    const deleted = deletedLabels[event.id];
    if (deleted) return `${deleted} (eliminato)`;
    // Con l'elenco caricato e l'item assente, è stato eliminato; senza elenco (vault bloccato) non si può dire altro che il tipo.
    return elements ? `${typeLabel} non più presente` : typeLabel;
  }

  function change(patch: Partial<AuditFilters>) {
    commit({ ...filters, ...patch, page: 1 });
  }

  function openDetail(event: AuditEventListItem) {
    setSelected(event);
    setPanelOpen(true);
  }

  function showEntityActivity(event: AuditEventListItem) {
    if (!event.entityType || !event.entityId) return;
    setPanelOpen(false);
    change({ entity: { type: event.entityType, id: event.entityId } });
  }

  function toggleType(type: AuditEventType) {
    change({
      types: filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type],
    });
  }

  const loading = result?.key !== requestKey && failure?.key !== requestKey;
  const error = failure?.key === requestKey ? failure.message : null;
  const events = result?.data.events ?? [];
  const total = result?.data.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const activeFilters = countActiveAuditFilters(filters);
  const visibleAreas: AuditEventCategory[] = filters.area ? [filters.area] : AUDIT_EVENT_CATEGORIES;

  const entityKey = filters.entity ? auditElementKey(filters.entity.type, filters.entity.id) : "";
  const entityKnown = elementLabels.has(entityKey);
  const entityFilterLabel = filters.entity
    ? `${AUDIT_ENTITY_TYPE_LABEL[filters.entity.type]}: ${elementLabels.get(entityKey) ?? "elemento selezionato"}`
    : "";
  const elementOptionsByType = ENTITY_TYPES.map((type) => ({
    type,
    options: (elements ?? [])
      .filter((element) => element.type === type)
      .sort((a, b) => a.label.localeCompare(b.label, "it")),
  })).filter((group) => group.options.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Attività</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Tutto ciò che è successo sul tuo account e sui tuoi contenuti. Qui vedi solo cosa è stato fatto e quando:
          il contenuto dei tuoi dati resta privato.
        </p>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filtri attività"
        className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-from`} className={LABEL_CLASS}>
              Dal
            </label>
            <input
              id={`${uid}-from`}
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => change({ from: e.target.value })}
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-to`} className={LABEL_CLASS}>
              Al
            </label>
            <input
              id={`${uid}-to`}
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => change({ to: e.target.value })}
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => change(lastDaysRange(7))} className={SECONDARY_BUTTON_CLASS}>
              Ultimi 7 giorni
            </button>
            <button type="button" onClick={() => change(lastDaysRange(30))} className={SECONDARY_BUTTON_CLASS}>
              Ultimi 30 giorni
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-area`} className={LABEL_CLASS}>
              Area
            </label>
            <select
              id={`${uid}-area`}
              value={filters.area ?? ""}
              onChange={(e) => {
                const area = (e.target.value || null) as AuditEventCategory | null;
                change({ area, types: typesWithinArea(filters.types, area) });
              }}
              className={FIELD_CLASS}
            >
              <option value="">Tutte le aree</option>
              {AUDIT_EVENT_CATEGORIES.map((area) => (
                <option key={area} value={area}>
                  {AUDIT_EVENT_CATEGORY_LABEL[area]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`${uid}-element`} className={LABEL_CLASS}>
              Elemento
            </label>
            <select
              id={`${uid}-element`}
              value={entityKey}
              disabled={!elements && !filters.entity}
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                change({ entity: type && id ? { type: type as AuditEntityType, id } : null });
              }}
              className={`${FIELD_CLASS} max-w-64`}
            >
              <option value="">
                {elements || filters.entity ? "Tutti gli elementi" : "Sblocca il vault per sceglierlo"}
              </option>
              {filters.entity && !entityKnown ? <option value={entityKey}>{entityFilterLabel}</option> : null}
              {elementOptionsByType.map((group) => (
                <optgroup key={group.type} label={AUDIT_ENTITY_TYPE_LABEL[group.type]}>
                  {group.options.map((element) => (
                    <option key={element.id} value={auditElementKey(element.type, element.id)}>
                      {element.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <details className="group relative">
            <summary
              className={`${FIELD_CLASS} flex cursor-pointer list-none items-center gap-2 select-none`}
              aria-label="Tipo di evento"
            >
              Tipo di evento
              {filters.types.length > 0 ? (
                <span className="rounded-full bg-brand px-2 text-xs font-medium text-white">{filters.types.length}</span>
              ) : null}
              <span aria-hidden="true" className="text-zinc-400">
                ▾
              </span>
            </summary>
            <div className="absolute z-20 mt-1 flex max-h-80 w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              {visibleAreas.map((area) => (
                <fieldset key={area} className="flex flex-col gap-1.5">
                  <legend className="mb-1 text-xs font-semibold text-zinc-500 uppercase dark:text-zinc-400">
                    {AUDIT_EVENT_CATEGORY_LABEL[area]}
                  </legend>
                  {auditEventTypesOf(area).map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggleType(type)} />
                      {AUDIT_EVENT_TYPE_LABEL[type]}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </details>
        </div>

        {activeFilters > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <ul aria-label="Filtri attivi" className="flex flex-wrap items-center gap-2">
              {filters.from || filters.to ? (
                <FilterChip label={periodLabel(filters.from, filters.to)} onRemove={() => change({ from: "", to: "" })} />
              ) : null}
              {filters.area ? (
                <FilterChip
                  label={AUDIT_EVENT_CATEGORY_LABEL[filters.area]}
                  onRemove={() => change({ area: null })}
                />
              ) : null}
              {filters.types.map((type) => (
                <FilterChip key={type} label={AUDIT_EVENT_TYPE_LABEL[type]} onRemove={() => toggleType(type)} />
              ))}
              {filters.entity ? <FilterChip label={entityFilterLabel} onRemove={() => change({ entity: null })} /> : null}
            </ul>
            <button
              type="button"
              onClick={() => commit({ ...EMPTY_AUDIT_FILTERS, pageSize: filters.pageSize })}
              className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Azzera filtri
            </button>
          </div>
        ) : null}
      </form>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {!result && !error ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : result && total === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {activeFilters > 0 ? "Nessuna attività trovata con questi filtri." : "Nessuna attività registrata."}
          </p>
        </div>
      ) : result ? (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    Attività
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Elemento
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
                    <td className="p-3 text-zinc-700 dark:text-zinc-300">
                      <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[event.type]}</span>{" "}
                      <EventLabel event={event} fieldLabels={fieldLabels} />
                    </td>
                    <td className="max-w-64 truncate p-3 text-zinc-700 dark:text-zinc-300">
                      {elementLabel(event) ?? <span className="text-zinc-400 dark:text-zinc-600">—</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {formatDateTime(event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {result && total > 0 ? (
        <div className="flex flex-col gap-3">
          <Pagination page={filters.page} pageCount={pageCount} onChange={(page) => commit({ ...filters, page })} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
              {total === 1 ? "1 attività" : `${total} attività`}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor={`${uid}-size`} className={LABEL_CLASS}>
                Righe per pagina
              </label>
              <select
                id={`${uid}-size`}
                value={filters.pageSize}
                onChange={(e) => change({ pageSize: Number(e.target.value) as AuditPageSize })}
                className={FIELD_CLASS}
              >
                {AUDIT_PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} label="Dettaglio attività">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[selected.type]}</span>{" "}
                <EventLabel event={selected} fieldLabels={fieldLabels} />
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
              {selected.entityType ? (
                <div>
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {AUDIT_ENTITY_TYPE_LABEL[selected.entityType]}
                  </dt>
                  <dd className="break-words text-zinc-800 dark:text-zinc-200">{elementLabel(selected)}</dd>
                </div>
              ) : null}
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
                  <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Dispositivo/browser</dt>
                  <dd className="break-words text-zinc-800 dark:text-zinc-200">{selected.metadata.userAgent}</dd>
                </div>
              ) : null}
              {!selected.entityType &&
              !selected.metadata?.method &&
              !selected.metadata?.ip &&
              !selected.metadata?.userAgent ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Nessun altro dettaglio disponibile per questo evento.
                </p>
              ) : null}
            </dl>

            {selected.entityType && selected.entityId ? (
              <button type="button" onClick={() => showEntityActivity(selected)} className={SECONDARY_BUTTON_CLASS}>
                Mostra tutte le attività di questo elemento
              </button>
            ) : null}
          </>
        ) : null}
      </SidePanel>
    </div>
  );
}
