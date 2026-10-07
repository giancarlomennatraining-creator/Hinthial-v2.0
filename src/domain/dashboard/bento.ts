import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import type { DocumentSummary } from "@/domain/documents/types";
import { computeOnboardingSteps } from "@/domain/onboarding/steps";
import { daysUntil, whenText } from "@/domain/dashboard/deadlines";

export interface BentoCapsule {
  title: string;
  days: number;
  /** Quando si apre (ISO). */
  openAt: string;
  /** Quante altre capsule, oltre a questa, devono ancora aprirsi. */
  others: number;
  /** Il nome proprio del primo destinatario, o null se la capsula non ne ha. */
  recipient: string | null;
}

export interface BentoAssetRow {
  id: string;
  name: string;
  /** "Revisione · tra 5 giorni" oppure "nessuna scadenza". */
  detail: string;
  status: "over" | "soon" | "ok";
}

export interface BentoData {
  /** La prossima scadenza aperta: la più vicina da oggi in poi, altrimenti la più vecchia già scaduta. null se non ce ne sono. */
  next: { reminder: ReminderListItem; days: number } | null;
  overdueCount: number;
  /** Aperte, da oggi a 30 giorni. */
  soonCount: number;
  documentCount: number;
  /** Documenti aggiunti negli ultimi 7 giorni. */
  newThisWeek: number;
  /** Fino a tre documenti recenti, per il ventaglio e per "Appena aggiunti". */
  recentDocuments: DocumentSummary[];
  nextCapsule: BentoCapsule | null;
  friendCount: number;
  guardianCount: number;
  assetCount: number;
  assetRows: BentoAssetRow[];
  /** I passi di avvio completati su quanti sono, e il primo che manca. */
  steps: { done: number; total: number; missing: { label: string; href: string } | null };
}

function firstNameOf(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/** Tutto ciò che serve ai riquadri della dashboard "Bento", ricavato dallo stesso contesto delle altre. */
export function buildBento(context: SummaryContext, now: Date): BentoData {
  const open = context.reminders
    .filter((r) => !r.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const upcoming = open.find((r) => daysUntil(r.dueAt, now) >= 0) ?? null;
  const oldestOverdue = open[0] && daysUntil(open[0].dueAt, now) < 0 ? open[0] : null;
  const nextReminder = upcoming ?? oldestOverdue;

  const futureCapsules = context.capsules
    .filter((c) => c.openAt !== null && daysUntil(c.openAt, now) >= 0)
    .sort((a, b) => new Date(a.openAt as string).getTime() - new Date(b.openAt as string).getTime());
  const capsule = futureCapsules[0] ?? null;
  const recipient = capsule?.relatedFriends[0] ?? null;

  const assetRows: BentoAssetRow[] = context.assets
    .map((asset) => {
      const mine = open.filter((r) => r.relatedAssetId === asset.id);
      // Una scadenza già passata conta più di qualunque futura: è la cosa da sistemare.
      const first = mine.find((r) => daysUntil(r.dueAt, now) < 0) ?? mine[0] ?? null;
      const days = first ? daysUntil(first.dueAt, now) : null;
      const status: BentoAssetRow["status"] = days === null ? "ok" : days < 0 ? "over" : days <= 30 ? "soon" : "ok";
      return {
        row: {
          id: asset.id,
          name: asset.name,
          detail: first && days !== null ? `${first.title} · ${whenText(days)}` : "nessuna scadenza",
          status,
        },
        // Chi ha una scadenza viene prima, la più vicina per prima; poi gli altri per nome.
        sortKey: days === null ? Number.POSITIVE_INFINITY : days,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.row.name.localeCompare(b.row.name, "it"))
    .slice(0, 3)
    .map((entry) => entry.row);

  const onboarding = computeOnboardingSteps({
    documents: context.documents,
    assets: context.assets,
    friends: context.friends,
    capsules: context.capsules,
  });
  const missingStep = onboarding.find((s) => !s.done) ?? null;

  const weekAgo = now.getTime() - 7 * 86_400_000;

  return {
    next: nextReminder ? { reminder: nextReminder, days: daysUntil(nextReminder.dueAt, now) } : null,
    overdueCount: open.filter((r) => daysUntil(r.dueAt, now) < 0).length,
    soonCount: open.filter((r) => {
      const d = daysUntil(r.dueAt, now);
      return d >= 0 && d <= 30;
    }).length,
    documentCount: context.documents.length,
    newThisWeek: context.documents.filter((d) => new Date(d.createdAt).getTime() >= weekAgo).length,
    recentDocuments: context.documents.slice(0, 3),
    nextCapsule: capsule
      ? {
          title: capsule.title,
          days: daysUntil(capsule.openAt as string, now),
          openAt: capsule.openAt as string,
          others: futureCapsules.length - 1,
          recipient: recipient ? firstNameOf(recipient.firstName || recipient.name) : null,
        }
      : null,
    friendCount: context.friends.filter((f) => f.isFriend).length,
    guardianCount: context.friends.filter((f) => f.isGuardian).length,
    assetCount: context.assets.length,
    assetRows,
    steps: {
      done: onboarding.filter((s) => s.done).length,
      total: onboarding.length,
      missing: missingStep ? { label: missingStep.label, href: missingStep.href } : null,
    },
  };
}
