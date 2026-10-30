import type { Category } from "@/domain/categories/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { STORIES_CATEGORY } from "@/domain/stories/questions";
import { NOTE_MIME_TYPE } from "@/lib/content-kind";

/**
 * Il piano: i passi per portare Hinthial dal primo avvio a "pronto a far arrivare ciò che sai e ciò che hai alle persone a
 * cui tieni, se un giorno non ci sei". Un'unica lista, in quattro pilastri; sostituisce la vecchia checklist
 * d'onboarding e il punteggio di continuità, che contavano le stesse cose in due modi. Puro: nessuna rete, nessun
 * database --- il chiamante porta i dati già letti.
 *
 * Si parte da zero: "Crea un account" non è un passo (è sempre fatto) e gonfiava la percentuale iniziale.
 */

export type PlanPillarId = "security" | "people" | "memories" | "legacy";

/** I pilastri, nell'ordine in cui si percorrono. Ognuno apre una foglia (o accende una stella) nel disegno di "Oggi". */
export const PLAN_PILLARS: { id: PlanPillarId; label: string }[] = [
  { id: "security", label: "Sicurezza" },
  { id: "people", label: "Persone" },
  { id: "memories", label: "Ricordi" },
  { id: "legacy", label: "Eredità" },
];

export type PlanStepKey =
  | "security"
  | "first-document"
  | "friend"
  | "guardian"
  | "story"
  | "capsule"
  | "emergency-card"
  | "delivery"
  | "legacy";

export interface PlanStep {
  key: PlanStepKey;
  pillar: PlanPillarId;
  label: string;
  /** Perché, in una riga: si legge sul prossimo passo. */
  description: string;
  done: boolean;
  /** Dove si fa. */
  href: string;
  /** Il verbo del link (es. "Scegli"). */
  action: string;
}

export interface PlanInput {
  documents: DocumentSummary[];
  categories: Category[];
  friends: FriendListItem[];
  capsules: CapsuleListItem[];
  legacyEnabled: boolean;
  /** La scheda d'emergenza ha almeno un dato. */
  emergencyCardFilled: boolean;
}

/** Un racconto è una nota, o un audio se raccontato a voce, nella categoria "Racconti" (v. domain/stories/repository.ts). */
function isStory(document: DocumentSummary, storiesCategoryId: string | undefined): boolean {
  return (
    storiesCategoryId !== undefined &&
    document.categoryId === storiesCategoryId &&
    (document.mimeType === NOTE_MIME_TYPE || document.mimeType.startsWith("audio/"))
  );
}

export function computePlan(input: PlanInput): PlanStep[] {
  const { documents, categories, friends, capsules, legacyEnabled, emergencyCardFilled } = input;

  const storiesCategoryId = categories.find((c) => c.name.trim().toLowerCase() === STORIES_CATEGORY.name.toLowerCase())?.id;
  const kept = documents.filter((d) => d.deletedAt === null);
  const hasStory = kept.some((d) => isStory(d, storiesCategoryId));
  // I racconti hanno il loro passo: "il primo documento" è qualcosa di diverso da un ricordo.
  const hasDocument = kept.some((d) => !isStory(d, storiesCategoryId));
  const capsulesForOthers = capsules.filter((c) => c.status !== "draft" && c.relatedFriends.length > 0);
  const capsulesForDelivery = capsulesForOthers.filter((c) => c.openOnLegacy);

  return [
    {
      key: "security",
      pillar: "security",
      label: "Crea la tua chiave",
      description: "La master password cifra tutto sul tuo dispositivo: la conosci solo tu.",
      // Il piano si calcola con la cassaforte sbloccata: la chiave c'è per forza.
      done: true,
      href: "/archive",
      action: "Crea",
    },
    {
      key: "first-document",
      pillar: "security",
      label: "Metti dentro il primo documento",
      description: "Hinthial lo legge sul tuo dispositivo, lo cifra, e da quel momento lo ritrovi cercando.",
      done: hasDocument,
      href: "/archive/new?mode=upload",
      action: "Aggiungi",
    },
    {
      key: "friend",
      pillar: "people",
      label: "Aggiungi una persona a cui tieni",
      description: "In Amici metti chi riceverà ciò che prepari.",
      done: friends.length > 0,
      href: "/friends",
      action: "Aggiungi",
    },
    {
      key: "guardian",
      pillar: "people",
      label: "Scegli un guardiano",
      description: "Una persona di fiducia: se un giorno non rispondi, Hinthial chiede a lei se riesce a raggiungerti.",
      done: friends.some((f) => f.isGuardian && f.status === "active"),
      href: "/friends",
      action: "Scegli",
    },
    {
      key: "story",
      pillar: "memories",
      label: "Racconta un primo ricordo",
      description: "Rispondi a una domanda di Raccontami: diventa un racconto cifrato, da far arrivare a chi vuoi.",
      done: hasStory,
      href: "/raccontami",
      action: "Racconta",
    },
    {
      key: "capsule",
      pillar: "memories",
      label: "Prepara una capsula per qualcuno",
      description: "Un messaggio sigillato per una persona: si apre alla sua data, o se un giorno non rispondi più.",
      done: capsules.some((c) => c.relatedFriends.length > 0),
      href: "/capsules/new",
      action: "Scrivi",
    },
    {
      key: "emergency-card",
      pillar: "legacy",
      label: "Compila la scheda d'emergenza",
      description: "Serve a chi ti soccorre adesso: allergie, farmaci, chi chiamare.",
      done: emergencyCardFilled,
      // Sta in Impostazioni -> Profilo, non in Eredità digitale: serve a chi ti soccorre adesso.
      href: "/settings?tab=profile&section=card",
      action: "Compila",
    },
    {
      key: "delivery",
      pillar: "legacy",
      label: "Scegli quali capsule arrivano anche se non ci sei",
      description: "Una capsula si apre alla sua data: qui scegli quelle che l'eredità può consegnare prima.",
      done: capsulesForDelivery.length > 0,
      // Con capsule già chiuse manca solo la scelta di quali consegnare; senza, manca la capsula stessa.
      href: capsulesForOthers.length > 0 ? "/legacy" : "/capsules/new",
      action: capsulesForOthers.length > 0 ? "Scegli" : "Scrivi",
    },
    {
      key: "legacy",
      pillar: "legacy",
      label: "Attiva l'Eredità digitale",
      description: "Scegli con quanta calma aspettare. Finché accedi a Hinthial non succede nulla.",
      done: legacyEnabled,
      href: "/legacy",
      action: "Attiva",
    },
  ];
}

export interface PlanPillarProgress {
  id: PlanPillarId;
  label: string;
  done: number;
  total: number;
  complete: boolean;
  steps: PlanStep[];
}

export interface PlanProgress {
  done: number;
  total: number;
  percent: number;
  /** Il primo passo da fare, nell'ordine del piano; `null` a piano finito. */
  next: PlanStep | null;
  pillars: PlanPillarProgress[];
}

export function planProgress(steps: PlanStep[]): PlanProgress {
  const done = steps.filter((s) => s.done).length;
  const pillars = PLAN_PILLARS.map((pillar) => {
    const own = steps.filter((s) => s.pillar === pillar.id);
    const ownDone = own.filter((s) => s.done).length;
    return { id: pillar.id, label: pillar.label, done: ownDone, total: own.length, complete: own.length > 0 && ownDone === own.length, steps: own };
  });
  return {
    done,
    total: steps.length,
    percent: steps.length === 0 ? 100 : Math.round((done / steps.length) * 100),
    next: steps.find((s) => !s.done) ?? null,
    pillars,
  };
}
