"use client";

import { useRef } from "react";
import { CapsuleArt, type CapsuleArtState } from "@/components/capsules/CapsuleArt";
import { formatDateTime } from "@/components/capsules/CapsuleCardParts";
import { CapsuleCountdown } from "@/components/capsules/CapsuleCountdown";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { originOf } from "@/components/capsules/opening/helpers";
import type { OpenOrigin } from "@/components/capsules/opening/types";
import { CAPSULE_STATUS_LABEL } from "@/domain/capsules/labels";
import type { SharedCapsuleListItem } from "@/domain/capsules/types";
import type { CapsuleStyle } from "@/lib/capsule-style";
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
 * Una capsula condivisa con me (Capsule > Condivise con me), nello stile scelto per l'elenco: busta (riga di sempre), Flat
 * (scheda con la capsula illustrata) o Oblò (riga con l'oblò). "Apri" parte dall'elemento disegnato, così gli effetti che si
 * allargano o escono da lì (v. opening/) hanno un punto da cui cominciare.
 */
export function SharedCapsuleItem({
  shared,
  style,
  showCountdown,
  now,
  onOpen,
}: {
  shared: SharedCapsuleListItem;
  style: CapsuleStyle;
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
          className="mt-1 w-fit rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover"
        >
          🔓 Apri
        </button>
      ) : (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Potrai aprirla quando arriverà la data di apertura.</p>
      )}
    </>
  );

  if (style === "porthole") {
    return (
      <li className="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-4 rounded-[18px] border border-[#dfe3f0] bg-white p-3 shadow-[0_2px_8px_rgba(18,26,53,0.05)] sm:grid-cols-[92px_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950">
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

  if (style === "flat") {
    return (
      <li className="flex min-w-0 flex-col rounded-[18px] border border-[#dfe3f0] bg-white shadow-[0_2px_8px_rgba(18,26,53,0.05)] dark:border-zinc-800 dark:bg-zinc-950">
        <div
          className={cn(
            "relative flex h-[92px] items-center overflow-hidden rounded-t-[17px] bg-gradient-to-b px-[18px]",
            canOpen
              ? "from-[#DDF6E8] to-[#C9EFD9] dark:from-[#0f2a1d] dark:to-[#0c2217]"
              : "from-[#E8EEFC] to-[#DCE5FA] dark:from-[#18213d] dark:to-[#141b33]",
          )}
        >
          <span aria-hidden="true" className="absolute -bottom-9 -right-5 h-[110px] w-[110px] rounded-full bg-white/45 dark:bg-white/5" />
          <span ref={artRef} className="relative z-[1] block w-[150px] -rotate-[7deg]">
            <CapsuleArt variant="flat" state={state} className={cn("w-full", canOpen && "[filter:drop-shadow(0_0_10px_rgba(47,210,126,.7))]")} />
          </span>
        </div>
        <div className="flex flex-col gap-2 p-4">{body}</div>
      </li>
    );
  }

  return <li className="flex flex-col gap-2 p-4">{body}</li>;
}
