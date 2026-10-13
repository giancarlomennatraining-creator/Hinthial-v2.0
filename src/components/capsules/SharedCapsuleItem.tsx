"use client";

import { useRef } from "react";
import "@/components/capsules/opening/opening.css";
import type { CapsuleArtState } from "@/components/capsules/CapsuleArt";
import { formatDateTime } from "@/components/capsules/CapsuleCardParts";
import { CapsuleCountdown } from "@/components/capsules/CapsuleCountdown";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { originOf } from "@/components/capsules/opening/helpers";
import type { OpenOrigin } from "@/components/capsules/opening/types";
import { CAPSULE_STATUS_LABEL } from "@/domain/capsules/labels";
import type { SharedCapsuleListItem } from "@/domain/capsules/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_BADGE_CLASS = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  ready: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  shared: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
} as const;

/** Quanta strada ha fatto una capsula condivisa verso l'apertura: da quando è stata condivisa fino alla data. */
function sharedProgress(shared: SharedCapsuleListItem, now: Date): number {
  if (!shared.openAt) return 0;
  const start = new Date(shared.sharedAt).getTime();
  const end = new Date(shared.openAt).getTime();
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/**
 * Una capsula condivisa con me (Capsule > Condivise con me): una riga con l'oblò, come nell'elenco delle proprie. "Apri"
 * parte dall'elemento disegnato, così gli effetti che si allargano o escono da lì (v. opening/) hanno un punto da cui
 * cominciare.
 */
export function SharedCapsuleItem({
  shared,
  showCountdown,
  now,
  onOpen,
}: {
  shared: SharedCapsuleListItem;
  showCountdown: boolean;
  now: Date;
  onOpen: (origin: OpenOrigin | null) => void;
}) {
  const artRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Il vero sblocco è lato database (nega la lettura prima della data): qui si decide solo se mostrare "Apri" o il countdown.
  const canOpen = shared.openAt !== null && new Date(shared.openAt) <= now;
  const state: CapsuleArtState = canOpen ? "ready" : "sealed";

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Da {shared.ownerName}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[shared.status]}`}>
          {CAPSULE_STATUS_LABEL[shared.status]}
        </span>
        {canOpen ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#D8F5E3] px-2.5 py-0.5 text-xs font-bold text-[#1c7c5a] dark:bg-green-950 dark:text-green-300">
            <span className="h-2 w-2 rounded-full bg-[#2FD27E]" aria-hidden="true" />
            Pronta da aprire
          </span>
        ) : null}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Condivisa il {formatDate(shared.sharedAt)}
        {shared.openAt ? ` · apertura prevista ${formatDateTime(shared.openAt)}` : ""}
      </p>

      {shared.openAt && showCountdown ? (
        <div className="mt-1">
          <CapsuleCountdown createdAt={shared.sharedAt} openAt={shared.openAt} size="sm" />
        </div>
      ) : null}

      {canOpen ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => onOpen(originOf(artRef.current) ?? originOf(buttonRef.current))}
          className="mt-1 w-fit rounded-md bg-[#1c7c5a] px-3.5 py-2 text-xs font-bold text-white shadow-[0_2px_6px_rgba(28,124,90,.35)] hover:bg-[#166a4c]"
        >
          🔓 Apri
        </button>
      ) : (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Potrai aprirla quando arriverà la data di apertura.</p>
      )}
    </>
  );

  return (
    <li className={cn("relative grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-start gap-4 rounded-[18px] border border-[#dfe3f0] bg-white p-3 pr-3 shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(18,26,53,0.12)] sm:grid-cols-[92px_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950", canOpen && "capsule-ajar")}>
      <CapsulePorthole
        ref={artRef}
        state={state}
        progress={sharedProgress(shared, now)}
        className={cn("h-[76px] w-[76px] sm:h-[92px] sm:w-[92px]", canOpen && "[filter:drop-shadow(0_0_8px_rgba(47,210,126,.55))]")}
      />
      <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">{body}</div>
    </li>
  );
}
