import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import type { AIContext } from "@/domain/ai/types";

/**
 * "Timeline della vita digitale": ogni voce è semplicemente quando un
 * elemento è stato creato (createdAt, già presente su ogni entità) ---
 * nessun nuovo dato, nessuna nuova query. Costruita dallo stesso
 * AIContext già usato da dashboard/ricerca globale/Assistente AI.
 */
export type TimelineEntryKind = "document" | "asset" | "reminder" | "contact" | "capsule";

export interface TimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  /** Per un elemento d'archivio riflette il suo tipo reale (documento/immagine/audio/video/nota); fisso per gli altri kind. */
  icon: string;
  label: string;
  /** ISO --- quando l'elemento è stato creato. */
  date: string;
  href: string;
}

const OTHER_KIND_ICON: Record<Exclude<TimelineEntryKind, "document">, string> = {
  asset: "🏠",
  reminder: "⏰",
  contact: "🤝",
  capsule: "📦",
};

export function buildTimeline(context: AIContext): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...context.documents.map((d) => ({
      id: d.id,
      kind: "document" as const,
      icon: CONTENT_KIND_ICON[contentKindFor(d.mimeType)],
      label: d.filename,
      date: d.createdAt,
      href: "/archive",
    })),
    ...context.assets.map((a) => ({
      id: a.id,
      kind: "asset" as const,
      icon: OTHER_KIND_ICON.asset,
      label: a.name,
      date: a.createdAt,
      href: "/assets",
    })),
    ...context.reminders.map((r) => ({
      id: r.id,
      kind: "reminder" as const,
      icon: OTHER_KIND_ICON.reminder,
      label: r.title,
      date: r.createdAt,
      href: "/reminders",
    })),
    ...context.contacts.map((c) => ({
      id: c.id,
      kind: "contact" as const,
      icon: OTHER_KIND_ICON.contact,
      label: c.name,
      date: c.createdAt,
      href: "/contacts",
    })),
    ...context.capsules.map((c) => ({
      id: c.id,
      kind: "capsule" as const,
      icon: OTHER_KIND_ICON.capsule,
      label: c.title,
      date: c.createdAt,
      href: "/capsules",
    })),
  ];

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export interface TimelineGroup {
  /** "Giugno 2026", localizzato. */
  label: string;
  entries: TimelineEntry[];
}

/** Raggruppa per mese di calendario (ora locale) --- entries deve già essere ordinato dal più recente, così anche i gruppi lo sono. */
export function groupTimelineByMonth(entries: TimelineEntry[]): TimelineGroup[] {
  const groups = new Map<string, TimelineEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.date);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  return [...groups.entries()].map(([key, groupEntries]) => {
    const [year, month] = key.split("-").map(Number);
    const rawLabel = new Date(year, month, 1).toLocaleDateString("it-IT", {
      month: "long",
      year: "numeric",
    });
    return { label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1), entries: groupEntries };
  });
}
