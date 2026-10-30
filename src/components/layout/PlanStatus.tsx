"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";
import { SecurityIcon } from "@/components/icons/nav-icons";
import { loadPlan } from "@/domain/plan/load";
import { planProgress } from "@/domain/plan/steps";
import { publishPlanProgress, usePlanProgress } from "@/lib/plan-progress-store";

const ITEM_CLASS = "flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900";
const IDLE_RING_CLASS =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 ring-1 ring-inset ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-700";

/**
 * L'indicatore del piano nella barra laterale: un anello col colore del brand per la quota fatta, "4/9", e al click porta a
 * "Oggi", dove il piano si legge e si prosegue (v. PlanCard). Prima di creare la master password invita a crearla; a
 * cassaforte bloccata non mostra nessun avanzamento (non si può calcolare senza decifrare) e il click apre lo sblocco.
 * Sbloccata, legge il piano una volta e poi riprende l'avanzamento da "Oggi" (v. plan-progress-store), così non rilegge
 * tutto a ogni cambio di pagina. Nascondibile da Impostazioni (una preferenza sincronizzata sul server, v.
 * OnboardingWidgetVisibilityProvider): il piano resta comunque in "Oggi".
 */
export function PlanStatus({ collapsed = false }: { collapsed?: boolean }) {
  const supabase = useSupabase();
  const { status } = useMasterKey();
  const { settling, requestUnlock } = useUnlockPrompt();
  const { hidden } = useOnboardingWidgetVisibility();
  const progress = usePlanProgress();

  // Non prima che la finestra di sblocco abbia finito di dissolversi: la pagina si popola dopo l'animazione.
  const masterKey = status.kind === "unlocked" && !settling ? status.masterKey : null;
  const needsLoad = masterKey !== null && progress === null;

  // Al blocco si dimentica l'avanzamento: con un altro sblocco (o un altro account) si rilegge.
  useEffect(() => {
    if (status.kind === "locked") publishPlanProgress(null);
  }, [status.kind]);

  useEffect(() => {
    if (!masterKey || !needsLoad) return;
    let cancelled = false;
    loadPlan(supabase, masterKey)
      .then((steps) => {
        if (cancelled) return;
        const { done, total } = planProgress(steps);
        publishPlanProgress({ done, total });
      })
      .catch(() => {
        // Indicatore secondario: se il caricamento fallisce, resta semplicemente non mostrato.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey, needsLoad]);

  // Mentre la finestra di sblocco si dissolve il vault è già aperto, ma la pagina non si è ancora popolata.
  const locked = status.kind === "locked" || (status.kind === "unlocked" && settling);

  if (hidden) return null;

  if (locked) {
    return (
      <button
        type="button"
        onClick={() => requestUnlock({ dismissible: true })}
        aria-label="Il tuo piano: sblocca la cassaforte per vedere l'avanzamento"
        title="Sblocca la cassaforte per vedere l'avanzamento"
        className={ITEM_CLASS}
      >
        <span aria-hidden="true" className={IDLE_RING_CLASS}>
          <SecurityIcon width={14} height={14} />
        </span>
        {collapsed ? null : (
          <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">Il tuo piano</span>
            <span className="block">Da sbloccare</span>
          </span>
        )}
      </button>
    );
  }

  if (status.kind === "not-set-up") {
    return (
      <Link
        href="/archive"
        aria-label="Il tuo piano: crea la tua chiave"
        title="Crea la tua chiave per iniziare"
        className={ITEM_CLASS}
      >
        <span aria-hidden="true" className={IDLE_RING_CLASS}>
          <SecurityIcon width={14} height={14} />
        </span>
        {collapsed ? null : (
          <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">Il tuo piano</span>
            <span className="block">Crea la tua chiave</span>
          </span>
        )}
      </Link>
    );
  }

  if (!masterKey || !progress) return null;

  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  const label = `Il tuo piano: ${progress.done} su ${progress.total}`;

  return (
    <Link href="/dashboard" aria-label={label} title={label} className={ITEM_CLASS}>
      <span
        aria-hidden="true"
        className="h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700"
        style={{
          // A piano finito (100%) il colore diventa verde, come le altre conferme di stato positivo nell'app.
          background: `conic-gradient(${percent === 100 ? "#22c55e" : "var(--color-brand)"} ${percent}%, rgba(161, 161, 170, 0.35) ${percent}%)`,
        }}
      />
      {collapsed ? null : (
        <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="block font-medium text-zinc-900 dark:text-zinc-100">Il tuo piano</span>
          <span className="block">
            {progress.done}/{progress.total}
          </span>
        </span>
      )}
    </Link>
  );
}
