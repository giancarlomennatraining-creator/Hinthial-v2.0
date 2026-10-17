import Link from "next/link";

/**
 * Il riquadro di un elenco ancora vuoto, con il primo passo a portata di dito. Prima diceva "col tasto qui sopra", ma
 * su telefono il tasto è il "+" in basso (v. MobileAddFab): il link qui dentro vale per tutti e due.
 */
export function EmptyListCard({ text, actionHref, actionLabel }: { text: string; actionHref: string; actionLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="hand-note text-sm text-zinc-500 dark:text-zinc-400">{text}</p>
      <Link href={actionHref} className="text-sm font-medium text-accent hover:underline">
        {actionLabel} →
      </Link>
    </div>
  );
}
