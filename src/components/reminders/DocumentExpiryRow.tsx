import Link from "next/link";
import { expiryInfo, formatDayMonthYear } from "@/domain/documents/archive-views";
import type { DocumentExpiry } from "@/domain/documents/repository";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = {
  overdue: "font-medium text-red-600 dark:text-red-400",
  danger: "font-medium text-red-600 dark:text-red-400",
  warn: "font-medium text-orange-600 dark:text-orange-400",
  soft: "",
  none: "",
} as const;

/**
 * Una riga di Archivio > Scadenze per la data di scadenza di un documento: sta nello stesso elenco delle scadenze create
 * come tali. La data si imposta dalla scheda del documento (o accettando la proposta di Hinthia): la riga porta alla
 * scheda, dove si cambia o si toglie. Non ha la casella "completata": la data passa da sola.
 */
export function DocumentExpiryRow({ item, now }: { item: DocumentExpiry; now: Date }) {
  const info = expiryInfo(item.expiresAt, now);
  return (
    <li>
      <Link
        href={`/archive/${item.id}`}
        className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="w-4 shrink-0 text-center text-sm leading-5">
            📄
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.filename}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDayMonthYear(item.expiresAt)} · <span className={cn(LEVEL_CLASS[info.level])}>{info.text}</span>
            </span>
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-zinc-500">
          ›
        </span>
      </Link>
    </li>
  );
}
