"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { computeOnboardingSteps, onboardingCompletionPercent } from "@/domain/onboarding/steps";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";

/** Messaggio accanto alla percentuale --- dal più alto al più basso, il primo che si applica vince. */
const ENCOURAGEMENT: { min: number; message: string }[] = [
  { min: 100, message: "Hai completato tutti i passi: il tuo Hinthial è pronto a fare il suo lavoro." },
  { min: 75, message: "Ci sei quasi: ancora pochi passi e avrai messo al sicuro tutto quello che conta." },
  { min: 50, message: "A buon punto --- continua così: ogni passo in più rende Hinthial più utile per te." },
  { min: 25, message: "Un buon inizio: completa i prossimi passi per iniziare a vedere il valore di Hinthial." },
  { min: 0, message: "Hai appena iniziato: i passi qui sotto ti guidano a mettere al sicuro ciò che conta." },
];

function messageFor(percent: number): string {
  return ENCOURAGEMENT.find((tier) => percent >= tier.min)!.message;
}

/**
 * Impostazioni -> Onboarding: la stessa checklist della dashboard/della
 * barra di navigazione (v. domain/onboarding/steps.ts, unica fonte),
 * ma come pagina a sé --- utile soprattutto per chi ha nascosto il
 * gadget nella barra (v. OnboardingStatus) e vuole comunque ritrovare
 * qui il proprio avanzamento, oltre a poterlo far ricomparire.
 */
export function OnboardingSettingsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const router = useRouter();
  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { hidden: widgetHidden, setHidden: setWidgetHidden } = useOnboardingWidgetVisibility();

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const context = await buildAIContext(supabase, masterKey);
      setSteps(
        computeOnboardingSteps({
          documents: context.documents,
          assets: context.assets,
          contacts: context.contacts,
          capsules: context.capsules,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l'avanzamento.");
    }
  }, [masterKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- v. GlobalSearch.tsx per lo stesso pattern (caricamento all'apertura/al montaggio).
    load();
  }, [load]);

  function toggleWidget() {
    setWidgetHidden(!widgetHidden);
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!steps) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  const percent = onboardingCompletionPercent(steps);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 p-6 text-center sm:flex-row sm:items-center sm:text-left dark:border-zinc-800">
        <span
          aria-hidden="true"
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700"
          style={{
            background: `conic-gradient(${percent === 100 ? "#22c55e" : "var(--color-brand)"} ${percent}%, rgba(161, 161, 170, 0.35) ${percent}%)`,
          }}
        >
          <span className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white text-xl font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            {percent}%
          </span>
        </span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{messageFor(percent)}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Attività</h3>
          <button
            type="button"
            onClick={toggleWidget}
            className="shrink-0 text-xs font-medium text-brand hover:underline"
          >
            {widgetHidden
              ? "Mostra di nuovo l'indicatore nella barra di navigazione"
              : "Nascondi l'indicatore dalla barra di navigazione"}
          </button>
        </div>

        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-4 p-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{step.label}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{step.description}</span>
              </div>
              {step.done ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                  ✅ Fatto
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push(step.href)}
                  className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Da fare
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
