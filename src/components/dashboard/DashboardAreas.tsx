import Link from "next/link";
import { COUNTERS } from "@/components/dashboard/DashboardCounters";
import type { SummaryContext } from "@/domain/ai/types";

/** "Le tue aree": una pastiglia per sezione con icona, numero e nome. Condiviso dagli stili di dashboard che la mostrano. */
export function DashboardAreas({ context }: { context: SummaryContext }) {
  return (
    <section aria-label="Le tue aree">
      <h3 className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        Le tue aree
      </h3>
      <div className="flex flex-wrap gap-2">
        {COUNTERS.map((counter) => (
          <Link
            key={counter.key}
            href={counter.href}
            aria-label={`${counter.label}: ${context[counter.key].length}`}
            className="flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white py-2 pl-2.5 pr-3.5 transition hover:-translate-y-0.5 hover:border-brand dark:border-zinc-800 dark:bg-zinc-950"
          >
            <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-[10px] bg-brand/10 text-brand">
              <counter.icon width={16} height={16} />
            </span>
            <span aria-hidden="true">
              <b className="block text-base font-extrabold leading-none text-zinc-900 dark:text-zinc-100">
                {context[counter.key].length}
              </b>
              <small className="text-xs text-zinc-500 dark:text-zinc-400">{counter.label}</small>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
