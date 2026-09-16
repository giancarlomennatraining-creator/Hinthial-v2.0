import Link from "next/link";
import { CheckCircleIcon, CircleIcon } from "@/components/icons/nav-icons";

export interface OnboardingStep {
  key: string;
  label: string;
  /** Breve descrizione dell'attività --- mostrata qui sotto l'etichetta per i passi non ancora fatti (v. sotto), oltre che in Impostazioni > Onboarding (v. OnboardingSettingsPanel). */
  description: string;
  done: boolean;
  href: string;
}

/**
 * "Prima esperienza" (v. HINTHIAL_MVP.md, sezione UI/UX): crea account ->
 * configura sicurezza -> primo documento -> categoria -> bene -> capsula
 * -> amico -> collegamento capsula-contatto. I due passi che presuppongono
 * un concetto nuovo (amico/Dead Man's Switch, il collegamento che lo usa)
 * vengono dopo quelli concreti apposta, non mescolati (v.
 * domain/onboarding/steps.ts). Nessun passo è più opzionale (erano
 * rimasti "bene"/"capsula"/"collegamento" facoltativi in una versione
 * precedente, insieme a "imposta una scadenza" --- rimosso perché
 * passivo rispetto al contribuire un contenuto): tutti contano nel
 * conteggio e nessuno è considerato "extra". Calcolata dal vivo dai dati
 * già caricati dal chiamante --- nessuno stato "onboarding completato"
 * persistito da nessuna parte: le voci già fatte restano comunque
 * elencate qui, senza barrato --- un promemoria di percorso, non
 * qualcosa da nascondere.
 *
 * La descrizione compare solo sotto i passi non ancora fatti --- una
 * volta completato un passo non serve più rispiegarlo, e i passi che
 * introducono un concetto nuovo (es. "Aggiungi un guardiano", legato al Dead
 * Man's Switch) restano altrimenti solo un'etichetta senza contesto.
 *
 * Nessun riquadro attorno alla lista: chi la mostra (il pannello laterale
 * del gadget in barra laterale, v. OnboardingStatus) fornisce già il
 * proprio contenitore.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Onboarding</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {doneCount}/{steps.length}
          </p>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          I passi per iniziare a usare Hinthial al meglio --- il tuo avanzamento resta qui finché
          non li avrai completati tutti.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircleIcon width={16} height={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleIcon width={16} height={16} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
              )}
              {step.done ? (
                <span className="text-zinc-700 dark:text-zinc-300">{step.label}</span>
              ) : (
                <Link href={step.href} className="font-medium text-brand hover:underline">
                  {step.label}
                </Link>
              )}
            </div>
            {!step.done ? (
              <p className="pl-6 text-xs text-zinc-500 dark:text-zinc-400">{step.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
