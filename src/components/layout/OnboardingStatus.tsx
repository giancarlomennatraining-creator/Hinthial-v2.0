"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { useMasterKey } from "@/components/crypto/MasterKeyProvider";
import { OnboardingChecklist, type OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import { computeOnboardingSteps, onboardingCompletionPercent } from "@/domain/onboarding/steps";
import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";

/** Stesso margine di RowActionsMenu, per lo stesso motivo. */
const MIN_SPACE_BELOW = 320;

/** Larghezza del pannello (v. classe w-80 più sotto) --- serve per decidere da che lato aprirlo. */
const PANEL_WIDTH = 320;

/**
 * Indicatore persistente di avanzamento "Onboarding",
 * sempre visibile nella barra laterale (non solo in dashboard) --- una
 * grafica a torta col solo colore del brand per la quota completata,
 * che al click apre la stessa checklist già vista in dashboard (v.
 * domain/onboarding/steps.ts, condivisa per non avere due liste che
 * possono disallinearsi).
 *
 * Visibile solo a cifratura sbloccata: senza Master Key non c'è nulla
 * da decifrare/calcolare, e mostrare uno stato "a caso" prima
 * confonderebbe più che aiutare. Caricato all'apertura della barra
 * (come DashboardWidgets, non pigro come GlobalSearch: qui il punto è
 * proprio vedere la percentuale senza dover cliccare), e ricaricato ad
 * ogni apertura del pannello per riflettere cambiamenti fatti altrove.
 *
 * Nascondibile dal pannello stesso ("Nascondi") --- una preferenza solo
 * di questo dispositivo (v. lib/onboarding-widget.ts), non un
 * completamento vero e proprio: l'avanzamento resta comunque
 * consultabile (e il gadget riattivabile) da Impostazioni > Onboarding.
 */
export function OnboardingStatus({ collapsed = false }: { collapsed?: boolean }) {
  const supabase = useRef(createClient()).current;
  const { status } = useMasterKey();

  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<
    { top?: number; bottom?: number; left?: number; right?: number } | null
  >(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Ancorato a destra invece che a sinistra quando non c'è spazio ad
      // aprirsi verso destra (es. barra laterale a destra, v.
      // NavOrientationProvider) --- altrimenti il pannello uscirebbe
      // dallo schermo.
      const spaceRight = window.innerWidth - rect.left;
      const horizontal =
        spaceRight < PANEL_WIDTH + 16
          ? { right: window.innerWidth - rect.right }
          : { left: rect.left };
      setPosition({
        ...(spaceBelow < MIN_SPACE_BELOW
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
        ...horizontal,
      });
      // Refresh su ogni apertura --- v. doc comment sopra.
      refresh();
    }
    setOpen((v) => !v);
  }

  if (!masterKey || !steps || hidden) return null;

  const percent = onboardingCompletionPercent(steps);

  return (
    <>
      <button
        ref={buttonRef}
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

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Onboarding"
              style={{
                position: "fixed",
                top: position.top,
                bottom: position.bottom,
                left: position.left,
                right: position.right,
              }}
              className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
            >
              <OnboardingChecklist steps={steps} />
              <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
