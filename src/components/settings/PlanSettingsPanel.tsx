"use client";

import { useOnboardingWidgetVisibility } from "@/components/layout/OnboardingWidgetVisibilityProvider";
import { BTN_SECONDARY } from "@/components/ui/styles";

/**
 * Impostazioni -> Il tuo piano: il piano si legge e si prosegue in "Oggi" (v. PlanCard). Qui resta solo la scelta di
 * mostrare o nascondere l'indicatore nella barra di navigazione; nascosto, il piano è comunque in "Oggi".
 */
export function PlanSettingsPanel() {
  const { hidden, setHidden } = useOnboardingWidgetVisibility();

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {hidden
          ? "L'indicatore del piano non compare nella barra di navigazione. Il piano resta in Oggi."
          : "L'indicatore del piano compare nella barra di navigazione e porta a Oggi, dove il piano si legge e si prosegue."}
      </p>
      <button type="button" onClick={() => setHidden(!hidden)} className={BTN_SECONDARY}>
        {hidden ? "Mostra di nuovo l'indicatore nella barra di navigazione" : "Nascondi l'indicatore dalla barra di navigazione"}
      </button>
    </div>
  );
}
