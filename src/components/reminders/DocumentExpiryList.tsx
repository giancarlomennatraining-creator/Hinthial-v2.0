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
 * I documenti con una data di scadenza, in Archivio > Scadenze: la data si imposta dalla scheda del documento (o
 * accettando la proposta di Hinthia), e qui si ritrova accanto alle scadenze create come tali. Ogni riga porta alla
 * scheda, dove la data si cambia o si toglie.
 */
export function DocumentExpiryList({ items, now }: { items: DocumentExpiry[]; now: Date }) {
  return (
    <section aria-label="Documenti in scadenza" className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Documenti in scadenza</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          La data viene dalla scheda di ogni documento: per cambiarla, aprilo.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-zinc-200 rounded-card border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {items.map((item) => {
          const info = expiryInfo(item.expiresAt, now);
          return (
            <li key={item.id}>
              <Link
                href={`/archive/${item.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.filename}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatDayMonthYear(item.expiresAt)} · <span className={cn(LEVEL_CLASS[info.level])}>{info.text}</span>
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-zinc-400">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
