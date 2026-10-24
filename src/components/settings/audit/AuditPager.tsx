import { AUDIT_PAGE_SIZES, type AuditFilters, type AuditPageSize } from "@/domain/audit/filters";
import { Pagination } from "@/components/ui/Pagination";
import { FIELD_CLASS, LABEL_CLASS } from "@/components/settings/audit/audit-format";

/** In fondo all'elenco: le pagine, quante attività ci sono e quante righe per pagina. */
export function AuditPager({
  uid,
  filters,
  total,
  pageCount,
  onChange,
  onCommit,
}: {
  uid: string;
  filters: AuditFilters;
  total: number;
  pageCount: number;
  onChange: (patch: Partial<AuditFilters>) => void;
  onCommit: (next: AuditFilters) => void;
}) {
  const change = onChange;
  const commit = onCommit;

  return (
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
  );
}
