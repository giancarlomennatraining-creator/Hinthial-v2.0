import { EMPTY_AUDIT_FILTERS, lastDaysRange, typesWithinArea, type AuditFilters } from "@/domain/audit/filters";
import {
  AUDIT_ENTITY_TYPE_LABEL,
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_CATEGORY_LABEL,
  AUDIT_EVENT_TYPE_LABEL,
  auditEventTypesOf,
  type AuditEventCategory,
} from "@/domain/audit/labels";
import { auditElementKey, type AuditElementOption } from "@/domain/audit/elements";
import type { AuditEntityType, AuditEventType } from "@/lib/audit/log-event";
import { PANEL } from "@/components/ui/styles";
import { FilterChip } from "@/components/settings/audit/FilterChip";
import {
  ENTITY_TYPES,
  FIELD_CLASS,
  LABEL_CLASS,
  SECONDARY_BUTTON_CLASS,
  periodLabel,
} from "@/components/settings/audit/audit-format";

/** Il modulo dei filtri: periodo, area, elemento, tipo di evento, e le etichette dei filtri attivi. */
export function AuditFilterForm({
  uid,
  filters,
  activeFilters,
  elements,
  elementLabels,
  onChange,
  onCommit,
  onToggleType,
}: {
  uid: string;
  filters: AuditFilters;
  activeFilters: number;
  elements: AuditElementOption[] | null;
  elementLabels: Map<string, string>;
  onChange: (patch: Partial<AuditFilters>) => void;
  onCommit: (next: AuditFilters) => void;
  onToggleType: (type: AuditEventType) => void;
}) {
  const change = onChange;
  const commit = onCommit;
  const toggleType = onToggleType;
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
    <form
      onSubmit={(e) => e.preventDefault()}
      aria-label="Filtri attività"
      className={`${PANEL} flex flex-col gap-4 p-4`}
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
            <span aria-hidden="true" className="text-zinc-500">
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
  );
}
