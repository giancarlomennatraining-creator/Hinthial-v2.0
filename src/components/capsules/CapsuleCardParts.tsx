"use client";

import { CAPSULE_STATUS_LABEL } from "@/domain/capsules/labels";
import { canCloseCapsule, capsuleChecks, isOpeningSoon } from "@/domain/capsules/overview";
import { repliesLabel } from "@/domain/capsules/replies";
import type { CapsuleListItem, CapsuleStatus } from "@/domain/capsules/types";
import { sortAlphabetically } from "@/lib/utils";
import { formatDate } from "@/lib/format";

/** I pezzi che tutti gli stili dell'elenco condividono: le pillole dello stato e la riga "per chi, da quando, fino a quando". */

const BADGE_CLASS: Record<CapsuleStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  ready: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  shared: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

export const WARN_CHIP = "rounded-full bg-[#fdf3dd] px-2 py-0.5 text-xs font-bold text-[#8a5a00] dark:bg-amber-950 dark:text-amber-300";

export function formatDateTime(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return `${formatDate(iso)}, ${time}`;
}

/** La data di apertura è già passata. */
export function isOpened(capsule: Pick<CapsuleListItem, "openAt">, now: Date): boolean {
  return capsule.openAt !== null && new Date(capsule.openAt).getTime() <= now.getTime();
}

/** Stato, "Si apre presto", la regola dell'eredità, cosa manca a una bozza e i pensieri ricevuti. */
export function CapsuleChips({
  capsule,
  now,
  repliesCount = 0,
  onOpenReplies,
}: {
  capsule: CapsuleListItem;
  now: Date;
  repliesCount?: number;
  onOpenReplies?: () => void;
}) {
  const checks = capsule.status === "draft" ? capsuleChecks(capsule, now) : [];
  const warnings = checks.filter((check) => check.state === "warn").length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_CLASS[capsule.status]}`}>
        {CAPSULE_STATUS_LABEL[capsule.status]}
      </span>
      {isOpeningSoon(capsule, now) ? <span className={WARN_CHIP}>Si apre presto</span> : null}
      {capsule.openOnLegacy && !isOpened(capsule, now) ? (
        <span
          title="Si apre alla data scelta o, se arriva prima, quando l'Eredità digitale consegna le capsule"
          className="rounded-full bg-[#e8edfc] px-2 py-0.5 text-xs font-bold text-brand dark:bg-brand/20 dark:text-[#9db6ff]"
        >
          Anche prima, se non ci sono più
        </span>
      ) : null}
      {repliesCount > 0 && onOpenReplies ? (
        <button
          type="button"
          onClick={onOpenReplies}
          aria-label={`Leggi ${repliesLabel(repliesCount)} su ${capsule.title}`}
          className="rounded-full bg-[#e8edfc] px-2 py-0.5 text-xs font-bold text-brand hover:bg-[#d9e2fb] dark:bg-brand/20 dark:text-[#9db6ff]"
        >
          {repliesLabel(repliesCount)}
        </button>
      ) : null}
      {capsule.status === "draft" ? (
        !canCloseCapsule(checks) ? (
          <span className={WARN_CHIP}>Manca {checks.find((c) => c.state === "todo")?.label.toLowerCase()}</span>
        ) : warnings > 0 ? (
          <span className={WARN_CHIP}>
            Pronta da chiudere, {warnings} {warnings === 1 ? "avviso" : "avvisi"}
          </span>
        ) : (
          <span className="rounded-full bg-[#e3f4ec] px-2 py-0.5 text-xs font-bold text-[#1c7c5a] dark:bg-green-950 dark:text-green-300">
            Pronta da chiudere
          </span>
        )
      ) : null}
    </div>
  );
}

/** "Per Marco, Sofia · dal 12 ott 2026 · apertura prevista 12 mar 2038, 10:00". */
export function capsuleSubline(capsule: CapsuleListItem): string {
  const recipients = sortAlphabetically(capsule.relatedFriends, (c) => c.name)
    .map((c) => c.name)
    .join(", ");
  return `${recipients ? `Per ${recipients} · ` : ""}dal ${formatDate(capsule.createdAt)}${
    capsule.openAt ? ` · apertura prevista ${formatDateTime(capsule.openAt)}` : ""
  }`;
}
