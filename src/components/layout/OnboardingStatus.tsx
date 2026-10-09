"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { SidePanel } from "@/components/ui/SidePanel";
import { buildSummaryContext } from "@/domain/ai/context";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import {
  computeBasicOnboardingSteps,
  computeOnboardingSteps,
  onboardingCompletionPercent,
} from "@/domain/onboarding/steps";
import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";

/**
 * Indicatore persistente di avanzamento "Onboarding" nella barra laterale: una torta col colore del brand per la
 * quota completata, che al click apre la stessa checklist di dashboard (v. domain/onboarding/steps.ts, condivisa per
 * non avere due liste disallineate). Visibile anche prima dello sblocco con solo i primi due passi (v.
 * computeBasicOnboardingSteps), noti senza decifrare nulla; la checklist completa (8 passi) prende il posto una volta
 * sbloccata la Master Key. Il pannello è a tutto schermo (non un riquadro ancorato) perché ogni passo mostra anche
 * una breve descrizione. Nascondibile dal pannello stesso, una preferenza sincronizzata sul server (v.
 * OnboardingWidgetVisibilityProvider): l'avanzamento resta comunque consultabile da Impostazioni > Onboarding.
 */
export function OnboardingStatus({ collapsed = false }: { collapsed?: boolean }) {
  const supabase = useSupabase();
  const { status } = useMasterKey();
  const { settling } = useUnlockPrompt();

  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [open, setOpen] = useState(false);

  const { hidden, setHidden } = useOnboardingWidgetVisibility();
  // Non prima che la finestra di sblocco abbia finito di dissolversi: la pagina si popola dopo l'animazione.
  const masterKey = status.kind === "unlocked" && !settling ? status.masterKey : null;

  function hide() {
    setHidden(true);
    setOpen(false);
  }

  const refresh = useCallback(async () => {
    if (!masterKey) return;
    try {
      const context = await buildSummaryContext(supabase, masterKey);
      setSteps(
        computeOnboardingSteps({
          documents: context.documents,
          assets: context.assets,
          friends: context.friends,
          capsules: context.capsules,
        }),
      );
    } catch {
      // Indicatore secondario: se il caricamento fallisce, resta semplicemente non mostrato.
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function toggle() {
    if (!open) refresh(); // v. doc comment sopra
    setOpen((v) => !v);
  }

  // Prima dello sblocco, solo i primi due passi; "checking" resta senza indicatore.
  const displaySteps = masterKey
    ? steps
    : status.kind === "checking"
      ? null
      : computeBasicOnboardingSteps(status.kind === "locked");

  if (!displaySteps || hidden) return null;

  const percent = onboardingCompletionPercent(displaySteps);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Onboarding: ${percent}% completato`}
        title={`Onboarding: ${percent}% completato`}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-zinc-300 dark:ring-zinc-700"
          style={{
            // A onboarding completato (100%) il colore diventa verde, come le altre conferme di stato positivo nell'app.
            background: `conic-gradient(${percent === 100 ? "#22c55e" : "var(--color-brand)"} ${percent}%, rgba(161, 161, 170, 0.35) ${percent}%)`,
          }}
        />
        {collapsed ? null : (
          <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">Onboarding</span>
            <span className="block">{percent}% completato</span>
          </span>
        )}
      </button>

      <SidePanel open={open} onClose={() => setOpen(false)} label="Onboarding">
        {/* Niente titolo qui: OnboardingChecklist ha già la sua intestazione "Onboarding X/Y". */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Chiudi"
            className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        <OnboardingChecklist steps={displaySteps} />

        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={hide}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Nascondi
          </button>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Non comparirà più qui: l&apos;avanzamento resta consultabile in Impostazioni.
          </p>
        </div>
      </SidePanel>
    </>
  );
}
