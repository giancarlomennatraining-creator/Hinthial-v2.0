import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

export interface OnboardingSourceData {
  documents: DocumentListItem[];
  assets: AssetListItem[];
  contacts: TrustedContactListItem[];
  capsules: CapsuleListItem[];
}

/**
 * "Onboarding", estratta qui perché serve sia alla dashboard (v.
 * DashboardWidgets) sia all'indicatore persistente nel menu laterale
 * (v. components/layout/OnboardingStatus) --- una sola definizione, mai
 * due liste che possono andare fuori sincrono.
 *
 * Account e cifratura sono per definizione già fatti se questo viene
 * chiamato con un AIContext già costruito (richiede la Master Key
 * sbloccata). Nessun passo è opzionale: contano tutti nel conteggio
 * (v. isOnboardingComplete/onboardingCompletionPercent sotto). "Amico"
 * è un prerequisito reale: senza almeno un amico non si può attivare il
 * Dead Man's Switch semplificato per le capsule (v. domain/contacts,
 * isFriend). "Imposta una scadenza" non è più un passo: è un'attività
 * passiva rispetto al contribuire un contenuto vero e proprio.
 */
export function computeOnboardingSteps(data: OnboardingSourceData): OnboardingStep[] {
  const { documents, assets, contacts, capsules } = data;

  return [
    {
      key: "account",
      label: "Crea un account",
      description: "Hai creato il tuo account Hinthial.",
      done: true,
      href: "/dashboard",
    },
    {
      key: "security",
      label: "Configura la cifratura",
      description: "Hai impostato la master password e la cifratura del tuo vault.",
      done: true,
      href: "/archive",
    },
    {
      key: "document",
      label: "Aggiungi il primo contenuto all'archivio",
      description: "Carica un documento, una foto, un audio, un video o scrivi una nota.",
      done: documents.length > 0,
      href: "/archive",
    },
    {
      key: "category",
      label: "Assegna una categoria a un contenuto",
      description: "Organizza un contenuto già in archivio assegnandogli una categoria.",
      done: documents.some((d) => d.categoryId !== null),
      href: "/archive",
    },
    {
      key: "friend",
      label: "Aggiungi un amico",
      description:
        "Segna almeno un contatto fiduciario come amico: senza almeno un amico non si può attivare il Dead Man's Switch delle capsule.",
      done: contacts.some((c) => c.isFriend),
      href: "/contacts",
    },
    {
      key: "asset",
      label: "Aggiungi il primo asset",
      description: "Censisci una casa, un veicolo, un'assicurazione o un contratto.",
      done: assets.length > 0,
      href: "/assets",
    },
    {
      key: "capsule",
      label: "Crea la tua prima capsula",
      description: "Prepara un messaggio o un contenuto cifrato da lasciare a chi vuoi tu.",
      done: capsules.length > 0,
      href: "/capsules",
    },
    {
      key: "capsule-contact",
      label: "Collega una capsula a un contatto",
      description: "Scegli chi riceverà una delle tue capsule, tra i tuoi contatti fiduciari.",
      done: capsules.some((c) => c.relatedContacts.length > 0),
      href: "/capsules",
    },
  ];
}

export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}

/** Percentuale su tutti i passi --- stesso denominatore del "X/Y" già mostrato in OnboardingChecklist. */
export function onboardingCompletionPercent(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 100;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
