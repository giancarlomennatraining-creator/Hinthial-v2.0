"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { SidePanel } from "@/components/ui/SidePanel";
import { buildAIContext } from "@/domain/ai/context";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import {
  computeBasicOnboardingSteps,
  computeOnboardingSteps,
  onboardingCompletionPercent,
} from "@/domain/onboarding/steps";
import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";

/**
 * Indicatore persistente di avanzamento "Onboarding",
 * sempre visibile nella barra laterale (non solo in dashboard) --- una
 * grafica a torta col solo colore del brand per la quota completata,
 * che al click apre la stessa checklist già vista in dashboard (v.
 * domain/onboarding/steps.ts, condivisa per non avere due liste che
 * possono disallinearsi).
 *
 * Visibile anche prima dello sblocco --- mostra solo i primi due passi
 * (account + cifratura, v. computeBasicOnboardingSteps), il cui stato è
 * già noto da useMasterKey().status senza dover decifrare nulla: un
 * utente nuovo vede così subito un punto di partenza, invece di
 * scoprire il gadget solo dopo aver già configurato la cifratura da
 * sé. La checklist completa (8 passi) prende il suo posto non appena la
 * Master Key è sbloccata. Caricato all'apertura della barra (come
 * DashboardWidgets, non pigro come GlobalSearch: qui il punto è proprio
 * vedere la percentuale senza dover cliccare), e ricaricato ad ogni
 * apertura del pannello per riflettere cambiamenti fatti altrove.
 *
 * Il click apre un pannello laterale a tutto schermo (stesso pattern del
 * dettaglio attività in Impostazioni > Attività, v. AuditLogPanel) invece
 * di un piccolo riquadro ancorato al pulsante: da quando ogni passo non
 * fatto mostra anche una breve descrizione (v. OnboardingChecklist), il
 * contenuto è diventato troppo alto per un riquadro flottante --- niente
 * più calcolo di posizione/spazio disponibile.
 *
 * Nascondibile dal pannello stesso ("Nascondi") --- una preferenza
 * sincronizzata sul server (v. OnboardingWidgetVisibilityProvider), non un
 * completamento vero e proprio: l'avanzamento resta comunque
 * consultabile (e il gadget riattivabile) da Impostazioni > Onboarding.
 */
export function OnboardingStatus({ collapsed = false }: { collapsed?: boolean }) {
  const supabase = useRef(createClient()).current;
  const { status } = useMasterKey();

  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [open, setOpen] = useState(false);

  const { hidden, setHidden } = useOnboardingWidgetVisibility();
  const masterKey = status.kind === "unlocked" ? status.masterKey : null;

  function hide() {
    setHidden(true);
    setOpen(false);
  }

  const refresh = useCallback(async () => {
    if (!masterKey) return;
    try {
      const context = await buildAIContext(supabase, masterKey);
      setSteps(
        computeOnboardingSteps({
          documents: context.documents,
          assets: context.assets,
          contacts: context.contacts,
          capsules: context.capsules,
        }),
      );
    } catch {
      // Nessun blocco dell'interfaccia per questo indicatore secondario:
      // se il caricamento fallisce, resta semplicemente non mostrato.
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggle() {
    if (!open) refresh(); // v. doc comment sopra
    setOpen((v) => !v);
  }

  // Prima dello sblocco, solo i primi due passi (v. doc comment sopra) ---
  // "checking" (stato non ancora noto) resta senza indicatore, come prima.
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
            // A onboarding completato (100%) il colore diventa verde,
            // come le altre conferme di stato positivo nell'app (es. il
            // badge "Master password creata" in dashboard) --- sotto al
            // 100% resta il colore del brand.
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
        {/*
          Niente titolo qui: OnboardingChecklist ha già la sua
          intestazione "Onboarding X/Y" --- ripeterlo sopra sarebbe
          ridondante. Solo il tasto per chiudere.
        */}
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
