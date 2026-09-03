import Link from "next/link";

export interface OnboardingStep {
  key: string;
  label: string;
  done: boolean;
  href: string;
  optional?: boolean;
}

/**
 * "Prima esperienza" della dashboard (v. HINTHIAL_MVP.md, sezione UI/UX):
 * crea account -> configura sicurezza -> primo documento -> categoria
 * (obbligatori) -> asset, contatto, capsula, collegamento capsula-contatto,
 * scadenza (opzionali, per far scoprire il resto dell'app). Calcolata dal
 * vivo dai dati già caricati da DashboardWidgets --- nessuno stato
 * "onboarding completato" persistito da nessuna parte: quando i passi
 * obbligatori sono tutti fatti, la checklist smette semplicemente di
 * comparire.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const mandatory = steps.filter((s) => !s.optional);
  const doneCount = mandatory.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Primi passi con Hinthial
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {doneCount}/{mandatory.length}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">{step.done ? "✅" : "⬜"}</span>
            {step.done ? (
              <span className="text-zinc-500 line-through dark:text-zinc-500">{step.label}</span>
            ) : (
              <Link href={step.href} className="font-medium text-brand hover:underline">
                {step.label}
              </Link>
            )}
            {step.optional ? (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">(opzionale)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
