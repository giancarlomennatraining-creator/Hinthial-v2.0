import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Category } from "@/domain/categories/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { OnboardingStep } from "@/components/dashboard/OnboardingChecklist";
import { buildSummaryContext } from "@/domain/ai/context";
import { getDigitalLegacySettings } from "@/domain/digital-legacy/repository";
import { STORIES_CATEGORY } from "@/domain/stories/questions";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

export interface OnboardingSourceData {
  documents: DocumentSummary[];
  categories: Category[];
  friends: FriendListItem[];
  capsules: CapsuleListItem[];
  legacyEnabled: boolean;
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
    label: "Crea la tua chiave",
    description: "La master password cifra tutto sul tuo dispositivo: la conosci solo tu.",
    done,
    href: "/archive",
  };
}

/** Un racconto è una nota, o un audio se raccontato a voce, nella categoria "Racconti" (v. domain/stories/repository.ts). */
function hasStory(documents: DocumentSummary[], categories: Category[]): boolean {
  const stories = categories.find((c) => c.name.trim().toLowerCase() === STORIES_CATEGORY.name.toLowerCase());
  return (
    stories !== undefined &&
    documents.some((d) => d.categoryId === stories.id && (d.mimeType === NOTE_MIME_TYPE || d.mimeType.startsWith("audio/")))
  );
}

/**
 * I primi passi, uno per pilastro, nell'ordine della pagina pubblica: si comincia da un ricordo (Raccontami), si sceglie per
 * chi (Amici), gli si prepara qualcosa (Capsule) e si decide cosa succede se un giorno non rispondi più (guardiano ed
 * Eredità digitale). Estratta qui perché serve sia all'indicatore nel menu laterale sia a Impostazioni --- una sola
 * definizione. Nessun passo è opzionale: contano tutti.
 */
export function computeOnboardingSteps(data: OnboardingSourceData): OnboardingStep[] {
  const { documents, categories, friends, capsules, legacyEnabled } = data;

  return [
    ACCOUNT_STEP,
    securityStep(true),
    {
      key: "story",
      label: "Racconta un primo ricordo",
      description: "Rispondi a una domanda di Raccontami: diventa un racconto cifrato, da far arrivare a chi vuoi.",
      done: hasStory(documents, categories),
      href: "/raccontami",
    },
    {
      key: "friend",
      label: "Aggiungi una persona a cui tieni",
      description: "In Amici metti chi riceverà ciò che prepari.",
      done: friends.length > 0,
      href: "/friends",
    },
    {
      key: "capsule",
      label: "Prepara una capsula per qualcuno",
      description: "Un messaggio sigillato per una persona: si apre alla sua data, o se un giorno non rispondi più.",
      done: capsules.some((c) => c.relatedFriends.length > 0),
      href: "/capsules/new",
    },
    {
      key: "guardian",
      label: "Scegli un guardiano",
      description: "Una persona di fiducia: se un giorno non rispondi, Hinthial chiede a lei se riesce a raggiungerti.",
      done: friends.some((f) => f.isGuardian),
      href: "/friends",
    },
    {
      key: "legacy",
      label: "Attiva l'Eredità digitale",
      description: "Scegli con quanta calma aspettare. Finché accedi a Hinthial non succede nulla.",
      done: legacyEnabled,
      href: "/legacy",
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

/** Carica i dati e calcola la checklist completa: la usano l'indicatore in barra e Impostazioni > Onboarding. */
export async function loadOnboardingSteps(supabase: SupabaseClient<Database>, masterKey: CryptoKey): Promise<OnboardingStep[]> {
  const [context, legacyEnabled] = await Promise.all([
    buildSummaryContext(supabase, masterKey),
    supabase.auth.getUser().then(({ data: { user } }) =>
      user ? getDigitalLegacySettings(supabase, user.id).then((s) => s.enabled, () => false) : false,
    ),
  ]);
  return computeOnboardingSteps({
    documents: context.documents,
    categories: context.categories,
    friends: context.friends,
    capsules: context.capsules,
    legacyEnabled,
  });
}
