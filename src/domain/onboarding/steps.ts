import type { DocumentListItem } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

export interface OnboardingSourceData {
  documents: DocumentListItem[];
  reminders: ReminderListItem[];
  assets: AssetListItem[];
  contacts: TrustedContactListItem[];
  capsules: CapsuleListItem[];
}

/**
 * "Prima esperienza" della spec, estratta qui perché serve sia alla
 * dashboard (v. DashboardWidgets, la card "Primi passi con Hinthial")
 * sia all'indicatore persistente nel menu laterale (v.
 * components/layout/OnboardingStatus) --- una sola definizione, mai due
 * liste che possono andare fuori sincrono.
 *
 * Account e cifratura sono per definizione già fatti se questo viene
 * chiamato con un AIContext già costruito (richiede la Master Key
 * sbloccata). Solo "documento", "categoria" e "amico" sono obbligatori
 * (v. onboardingCompletionPercent sotto): asset/capsula/collegamento
 * capsula-contatto/scadenza restano opzionali --- servono a far scoprire
 * le altre sezioni dell'app, ma nessuno è tenuto a usarle per
 * considerare l'onboarding concluso. "Amico" è obbligatorio perché è un
 * prerequisito reale: senza almeno un amico non si può attivare il Dead
 * Man's Switch semplificato per le capsule (v. domain/contacts, isFriend).
 */
export function computeOnboardingSteps(data: OnboardingSourceData): OnboardingStep[] {
  const { documents, reminders, assets, contacts, capsules } = data;

  return [
    { key: "account", label: "Crea un account", done: true, href: "/dashboard" },
    { key: "security", label: "Configura la cifratura", done: true, href: "/archive" },
    {
      key: "document",
      label: "Aggiungi il primo contenuto all'archivio",
      done: documents.length > 0,
      href: "/archive",
    },
    {
      key: "category",
      label: "Assegna una categoria a un contenuto",
      done: documents.some((d) => d.categoryId !== null),
      href: "/archive",
    },
    {
      key: "friend",
      label: "Aggiungi un amico",
      done: contacts.some((c) => c.isFriend),
      href: "/contacts",
    },
    {
      key: "asset",
      label: "Aggiungi il primo asset",
      done: assets.length > 0,
      href: "/assets",
      optional: true,
    },
    {
      key: "capsule",
      label: "Crea la tua prima capsula",
      done: capsules.length > 0,
      href: "/capsules",
      optional: true,
    },
    {
      key: "capsule-contact",
      label: "Collega una capsula a un contatto",
      done: capsules.some((c) => c.relatedContacts.length > 0),
      href: "/capsules",
      optional: true,
    },
    {
      key: "reminder",
      label: "Imposta una scadenza",
      done: reminders.length > 0,
      href: "/reminders",
      optional: true,
    },
  ];
}

export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.filter((s) => !s.optional).every((s) => s.done);
}

/** Percentuale sui soli passi obbligatori --- stesso denominatore del "X/Y" già mostrato in OnboardingChecklist. */
export function onboardingCompletionPercent(steps: OnboardingStep[]): number {
  const mandatory = steps.filter((s) => !s.optional);
  if (mandatory.length === 0) return 100;
  return Math.round((mandatory.filter((s) => s.done).length / mandatory.length) * 100);
}
