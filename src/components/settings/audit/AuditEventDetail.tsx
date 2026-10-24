import { AUDIT_ENTITY_TYPE_LABEL, AUDIT_EVENT_TYPE_ICON } from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";
import { EventLabel } from "@/components/settings/audit/EventLabel";
import { LOGIN_METHOD_LABEL, SECONDARY_BUTTON_CLASS, formatDateTime } from "@/components/settings/audit/audit-format";

/** Il contenuto del pannello laterale: quando, su quale elemento, con che metodo e da dove. */
export function AuditEventDetail({
  selected,
  fieldLabels,
  elementLabel,
  onClose,
  onShowEntityActivity,
}: {
  selected: AuditEventListItem;
  fieldLabels: Record<string, string>;
  elementLabel: (event: AuditEventListItem) => string | null;
  onClose: () => void;
  onShowEntityActivity: (event: AuditEventListItem) => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <span aria-hidden="true">{AUDIT_EVENT_TYPE_ICON[selected.type]}</span>{" "}
          <EventLabel event={selected} fieldLabels={fieldLabels} />
        </h3>
        <button
          type="button"
          onClick={() => onClose()}
          aria-label="Chiudi"
          className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
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
        <button type="button" onClick={() => onShowEntityActivity(selected)} className={SECONDARY_BUTTON_CLASS}>
          Mostra tutte le attività di questo elemento
        </button>
      ) : null}
    </>
  );
}
