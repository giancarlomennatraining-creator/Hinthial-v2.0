import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";

export interface OnboardingSourceData {
  documents: DocumentListItem[];
  assets: AssetListItem[];
  friends: FriendListItem[];
  capsules: CapsuleListItem[];
}

/**
 * I primi due passi --- unica definizione condivisa anche da
 * computeBasicOnboardingSteps qui sotto, usata prima ancora che la
 * Master Key sia sbloccata (v. OnboardingStatus/DashboardPanel): mai due
 * liste che possono andare fuori sincrono su etichetta/descrizione/href.
 */
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
 * "Onboarding", estratta qui perché serve sia alla dashboard (v.
 * DashboardWidgets) sia all'indicatore persistente nel menu laterale
 * (v. components/layout/OnboardingStatus) --- una sola definizione, mai
 * due liste che possono andare fuori sincrono.
 *
 * Account e cifratura sono per definizione già fatti se questo viene
 * chiamato con un AIContext già costruito (richiede la Master Key
 * sbloccata) --- v. computeBasicOnboardingSteps per i due passi da soli,
 * mostrabili anche prima. Nessun passo è opzionale: contano tutti nel
 * conteggio (v. isOnboardingComplete/onboardingCompletionPercent sotto).
 * "Guardiano" è un prerequisito reale: senza almeno un guardiano non si
 * può attivare il Dead Man's Switch semplificato per le capsule (v.
 * domain/friends, isGuardian) --- messo dopo bene/capsula apposta,
 * insieme al collegamento capsula-amico che lo richiede: i passi che
 * presuppongono un concetto nuovo vengono dopo quelli concreti e
 * immediati, non mescolati. "Imposta una scadenza" non è più un passo:
 * è un'attività passiva rispetto al contribuire un contenuto vero e
 * proprio.
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

/**
 * Solo i primi due passi (account + cifratura), mostrabili anche senza
 * Master Key sbloccata --- a differenza degli altri, il loro stato non
 * richiede di decifrare nulla: "fatto" o no è già noto da
 * useMasterKey().status. Usata da OnboardingStatus/DashboardPanel finché
 * la cifratura non è pronta, così l'indicatore non è semplicemente
 * assente in quella fase (v. doc comment lì per il motivo).
 */
export function computeBasicOnboardingSteps(encryptionConfigured: boolean): OnboardingStep[] {
  return [ACCOUNT_STEP, securityStep(encryptionConfigured)];
}

export function isOnboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}

/** Percentuale su tutti i passi --- stesso denominatore del "X/Y" già mostrato in OnboardingChecklist. */
export function onboardingCompletionPercent(steps: OnboardingStep[]): number {
  if (steps.length === 0) return 100;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
