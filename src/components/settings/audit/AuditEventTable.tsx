import { AUDIT_EVENT_TYPE_ICON } from "@/domain/audit/labels";
import type { AuditEventListItem } from "@/domain/audit/types";
import { PANEL } from "@/components/ui/styles";
import { EventLabel } from "@/components/settings/audit/EventLabel";
import { formatDateTime } from "@/components/settings/audit/audit-format";

/** L'elenco degli eventi della pagina: ogni riga si apre nel dettaglio. */
export function AuditEventTable({
  events,
  loading,
  fieldLabels,
  elementLabel,
  onOpen,
}: {
  events: AuditEventListItem[];
  loading: boolean;
  fieldLabels: Record<string, string>;
  elementLabel: (event: AuditEventListItem) => string | null;
  onOpen: (event: AuditEventListItem) => void;
}) {
  const openDetail = onOpen;

  return (
      <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <div className={`${PANEL} overflow-x-auto`}>
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
                    {elementLabel(event) ?? <span className="text-zinc-500 dark:text-zinc-500">—</span>}
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
  );
}
