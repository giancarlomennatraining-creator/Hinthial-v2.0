"use client";

import Link from "next/link";
import { useState } from "react";
import { PlanSign } from "@/components/dashboard/PlanSign";
import { Skeleton } from "@/components/ui/Skeleton";
import { BTN_PRIMARY } from "@/components/ui/styles";
import { planProgress, type PlanStep } from "@/domain/plan/steps";
import { cn } from "@/lib/utils";

const CARD =
  "min-w-0 surface-card rounded-card border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950";

/**
 * "Il tuo piano": la prima cosa di "Oggi". Finché il piano non è finito mette in evidenza solo il prossimo passo, con il
 * perché in una riga e un pulsante; il resto dei passi sta ripiegato sotto, per pilastro. A piano finito la scheda si
 * riduce a una riga di stato. `steps` è `null` mentre si leggono i dati.
 */
export function PlanCard({ steps }: { steps: PlanStep[] | null }) {
  const [expanded, setExpanded] = useState(false);
  const progress = steps ? planProgress(steps) : null;
  const complete = progress !== null && progress.next === null;

  return (
    <section aria-label="Il tuo piano" className={cn(CARD, "flex items-center gap-6")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">Il tuo piano</h2>
          {progress ? (
            <p className="text-sm font-semibold text-accent">
              {complete ? "Completo" : `${progress.done} su ${progress.total}`}
            </p>
          ) : null}
        </div>

        {progress ? (
          <>
            {complete ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Hinthial è pronto a far arrivare ciò che sai e ciò che hai alle persone a cui tieni, se un giorno non ci sei.
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Quanto Hinthial è pronto a far arrivare ciò che sai e ciò che hai alle persone a cui tieni, se un giorno non ci sei.
              </p>
            )}
            <div
              role="progressbar"
              aria-label="Il tuo piano"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="sig-bar mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
            >
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress.percent}%` }} />
            </div>

            {progress.next ? (
              <div className="mt-4 flex flex-col items-start gap-1">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Il prossimo passo</p>
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">{progress.next.label}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{progress.next.description}</p>
                <Link href={progress.next.href} className={cn(BTN_PRIMARY, "mt-2")}>
                  {progress.next.action} →
                </Link>
              </div>
            ) : null}

            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs font-semibold text-accent hover:underline"
            >
              {expanded ? "Nascondi i passi" : complete ? "Rivedi i passi" : "Vedi tutti i passi"}
            </button>

            {expanded ? (
              <div className="mt-3 flex flex-col gap-4">
                {progress.pillars.map((pillar) => (
                  <div key={pillar.id} role="group" aria-label={pillar.label} className="flex flex-col gap-2">
                    <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      {pillar.label}
                      <span className="font-normal">
                        {pillar.done}/{pillar.total}
                      </span>
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {pillar.steps.map((step) => (
                        <li key={step.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                step.done
                                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                                  : "border border-dashed border-zinc-300 text-zinc-500 dark:border-zinc-700",
                              )}
                            >
                              {step.done ? "✓" : ""}
                            </span>
                            <span className={cn("min-w-0", step.done ? "text-zinc-600 dark:text-zinc-400" : "font-medium text-zinc-900 dark:text-zinc-100")}>
                              {step.label}
                            </span>
                          </span>
                          {/* Il prossimo passo ha già il suo pulsante qui sopra. */}
                          {step.done || step.key === progress.next?.key ? null : (
                            <Link href={step.href} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                              {step.action} →
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div role="status" aria-label="Caricamento…" className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </div>
      {progress ? <PlanSign done={progress.pillars.map((pillar) => pillar.complete)} /> : null}
    </section>
  );
}
