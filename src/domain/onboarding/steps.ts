import type { DocumentSummary } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

export interface OnboardingSourceData {
  documents: DocumentSummary[];
  assets: AssetListItem[];
  friends: FriendListItem[];
  capsules: CapsuleListItem[];
}

/** Condivisa con computeBasicOnboardingSteps, usata anche prima dello sblocco --- mai due liste che vanno fuori sincrono. */
const ACCOUNT_STEP: OnboardingStep = {
  key: "account",
  label: "Crea un account",
  description: "Hai creato il tuo account Hinthial.",
  done: true,
  href: "/dashboard",
};

function securityStep(done: boolean): OnboardingStep {
  return {
    key: "security",
    label: "Configura la cifratura",
    description: "Crea la master password e la cifratura del tuo vault.",
    done,
    href: "/archive",
  };
}

/**
 * Estratta qui perché serve sia alla dashboard sia all'indicatore nel menu laterale --- una sola definizione. Nessun
 * passo è opzionale, contano tutti nel conteggio; "Guardiano" è messo dopo bene/capsula apposta, i passi che
 * presuppongono un concetto nuovo vengono dopo quelli concreti.
 */
export function computeOnboardingSteps(data: OnboardingSourceData): OnboardingStep[] {
  const { documents, assets, friends, capsules } = data;

  return [
    ACCOUNT_STEP,
    securityStep(true),
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
      key: "asset",
      label: "Aggiungi il primo bene",
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
      key: "guardian",
      label: "Aggiungi un guardiano",
      description:
        "Segna almeno un amico come guardiano: senza almeno un guardiano non si può attivare il Dead Man's Switch delle capsule.",
      done: friends.some((c) => c.isGuardian),
      href: "/friends",
    },
    {
      key: "capsule-friend",
      label: "Collega una capsula a un amico",
      description: "Scegli chi riceverà una delle tue capsule, tra i tuoi amici.",
      done: capsules.some((c) => c.relatedFriends.length > 0),
      href: "/capsules",
    },
  ];
}

/** Solo account+cifratura, mostrabili senza Master Key sbloccata --- il loro stato non richiede di decifrare nulla. */
export function computeBasicOnboardingSteps(encryptionConfigured: boolean): OnboardingStep[] {
  return [ACCOUNT_STEP, securityStep(encryptionConfigured)];
}

/** Percentuale su tutti i passi --- stesso denominatore del "X/Y" già mostrato in OnboardingChecklist. */
export function onboardingCompletionPercent(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 100;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
