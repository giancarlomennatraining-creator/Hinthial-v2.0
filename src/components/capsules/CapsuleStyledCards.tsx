"use client";

import type { ReactNode } from "react";
import { CapsuleArt, capsuleArtState } from "@/components/capsules/CapsuleArt";
import { CapsuleChips, capsuleSubline } from "@/components/capsules/CapsuleCardParts";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { capsuleProgress } from "@/domain/capsules/overview";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { cn } from "@/lib/utils";

/**
 * Gli stili "Flat" e "Oblò" dell'elenco delle capsule (lo stile "Buste" è CapsuleCard). Stessi dati e stesse proprietà: il
 * menu delle azioni, il conto alla rovescia e i contenuti li passa chi li disegna.
 */

interface StyledCardProps {
  capsule: CapsuleListItem;
  now: Date;
  menu: ReactNode;
  countdown: ReactNode;
  repliesCount?: number;
  onOpenReplies?: () => void;
  children?: ReactNode;
}

const TINT = {
  sealed: "from-[#E8EEFC] to-[#DCE5FA] dark:from-[#18213d] dark:to-[#141b33]",
  ready: "from-[#DDF6E8] to-[#C9EFD9] dark:from-[#0f2a1d] dark:to-[#0c2217]",
  draft: "from-[#F1F3F8] to-[#E8EBF2] dark:from-[#1b1d23] dark:to-[#15171c]",
} as const;

/** Flat: una piccola capsula illustrata inclinata sul fondo colorato della scheda, che si raddrizza al passaggio. */
export function CapsuleFlatCard({ capsule, now, menu, countdown, repliesCount = 0, onOpenReplies, children }: StyledCardProps) {
  const state = capsuleArtState(capsule, now);

  return (
    <li className="group relative flex min-w-0 flex-col rounded-[18px] border border-[#dfe3f0] bg-white shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_26px_rgba(18,26,53,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
      <div className={cn("relative flex h-[92px] items-center overflow-hidden rounded-t-[17px] bg-gradient-to-b px-[18px]", TINT[state])}>
        <span aria-hidden="true" className="absolute -bottom-9 -right-5 h-[110px] w-[110px] rounded-full bg-white/45 dark:bg-white/5" />
        <CapsuleArt
          variant="flat"
          state={state}
          className={cn(
            "relative z-[1] w-[150px] -rotate-[7deg] transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105",
            state === "ready" && "[filter:drop-shadow(0_0_10px_rgba(47,210,126,.7))]",
            state === "draft" && "opacity-60",
          )}
        />
        <span className="absolute right-2 top-2 z-10">{menu}</span>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.01em] text-[#121a35] dark:text-zinc-100">
          {capsule.title}
        </h3>
        <p className="text-xs text-[#5b6483] dark:text-zinc-400">{capsuleSubline(capsule)}</p>
        <CapsuleChips capsule={capsule} now={now} repliesCount={repliesCount} onOpenReplies={onOpenReplies} />
        {countdown}
        {children}
      </div>
    </li>
  );
}

/** Oblò: una riga compatta con l'oblò a sinistra e l'anello di avanzamento verso l'apertura. */
export function CapsulePortholeRow({ capsule, now, menu, countdown, repliesCount = 0, onOpenReplies, children }: StyledCardProps) {
  const state = capsuleArtState(capsule, now);

  return (
    <li className="relative grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-start gap-4 rounded-[18px] border border-[#dfe3f0] bg-white p-3 pr-3 shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(18,26,53,0.12)] sm:grid-cols-[92px_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950">
      <CapsulePorthole
        state={state}
        progress={capsuleProgress(capsule, now)}
        label={
          state === "ready"
            ? "Si può aprire ora"
            : state === "draft"
              ? "Bozza: il tempo non è ancora partito"
              : `Trascorso il ${Math.round(capsuleProgress(capsule, now) * 100)}% del tempo`
        }
        className={cn("h-[76px] w-[76px] sm:h-[92px] sm:w-[92px]", state === "ready" && "[filter:drop-shadow(0_0_8px_rgba(47,210,126,.55))]")}
      />
      <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.01em] text-[#121a35] dark:text-zinc-100">
            {capsule.title}
          </h3>
          <span className="shrink-0">{menu}</span>
        </div>
        <p className="text-xs text-[#5b6483] dark:text-zinc-400">{capsuleSubline(capsule)}</p>
        <CapsuleChips capsule={capsule} now={now} repliesCount={repliesCount} onOpenReplies={onOpenReplies} />
        {countdown}
        {children}
      </div>
    </li>
  );
}
