import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  /** Breve descrizione dell'attività --- usata in Impostazioni > Onboarding (v. OnboardingSettingsPanel), non qui. */
  description: string;
  done: boolean;
  href: string;
}

/**
 * "Prima esperienza" (v. HINTHIAL_MVP.md, sezione UI/UX): crea account ->
 * configura sicurezza -> primo documento -> categoria -> amico -> asset
 * -> capsula -> collegamento capsula-contatto. Nessun passo è più
 * opzionale (erano rimasti "asset"/"capsula"/"collegamento" facoltativi
 * in una versione precedente, insieme a "imposta una scadenza" ---
 * rimosso perché passivo rispetto al contribuire un contenuto): tutti
 * contano nel conteggio e nessuno è considerato "extra". Calcolata dal
 * vivo dai dati già caricati dal chiamante --- nessuno stato
 * "onboarding completato" persistito da nessuna parte: quando ogni
 * passo è fatto, la checklist smette semplicemente di comparire (v.
 * DashboardWidgets); le voci già fatte restano comunque elencate qui,
 * senza barrato --- un promemoria di percorso, non qualcosa da
 * nascondere.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Onboarding</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {doneCount}/{steps.length}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">{step.done ? "✅" : "⬜"}</span>
            {step.done ? (
              <span className="text-zinc-700 dark:text-zinc-300">{step.label}</span>
            ) : (
              <Link href={step.href} className="font-medium text-brand hover:underline">
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
