import type { SummaryContext } from "@/domain/ai/types";
import type { DocumentSummary } from "@/domain/documents/types";
import { buildBento, type BentoCapsule } from "@/domain/dashboard/bento";
import { daysUntil } from "@/domain/dashboard/deadlines";

export interface StoryDeadline {
  id: string;
  title: string;
  dueAt: string;
  days: number;
  assetName: string | null;
}

export interface StoriesData {
  /** Le cose che chiedono attenzione oggi: già scadute o entro 7 giorni. */
  attention: { count: number; overdue: number; thisWeek: number };
  /** Le prime tre scadenze aperte, quelle già passate per prime. */
  upcoming: StoryDeadline[];
  archive: { newThisWeek: number; total: number; recent: DocumentSummary[] };
  capsule: BentoCapsule | null;
  /** Primi passi: completati su quanti, e il primo che manca. */
  steps: { done: number; total: number; missing: { label: string; href: string } | null };
}

/** Il contenuto delle cinque "storie" della dashboard, ricavato dallo stesso contesto delle altre viste. */
export function buildStories(context: SummaryContext, now: Date): StoriesData {
  const bento = buildBento(context, now);

  const open = context.reminders
    .filter((r) => !r.completed)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const withDays = open.map((r) => ({ reminder: r, days: daysUntil(r.dueAt, now) }));
  const overdue = withDays.filter((x) => x.days < 0).length;
  const thisWeek = withDays.filter((x) => x.days >= 0 && x.days <= 7).length;

  return {
    attention: { count: overdue + thisWeek, overdue, thisWeek },
    upcoming: withDays.slice(0, 3).map(({ reminder, days }) => ({
      id: reminder.id,
      title: reminder.title,
      dueAt: reminder.dueAt,
      days,
      assetName: reminder.relatedAssetName,
    })),
    archive: { newThisWeek: bento.newThisWeek, total: bento.documentCount, recent: bento.recentDocuments },
    capsule: bento.nextCapsule,
    steps: bento.steps,
  };
}
