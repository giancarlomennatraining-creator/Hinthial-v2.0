"use client";

import type { ReactNode } from "react";
import { capsuleArtState } from "@/components/capsules/CapsuleArt";
import { CapsuleChips, capsuleSubline } from "@/components/capsules/CapsuleCardParts";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { capsuleProgress } from "@/domain/capsules/overview";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { cn } from "@/lib/utils";

/**
 * Una riga dell'elenco delle capsule: l'oblò a sinistra e l'anello di avanzamento verso l'apertura. Il menu delle azioni,
 * il conto alla rovescia e i contenuti li passa chi la disegna.
 */

interface PortholeRowProps {
  capsule: CapsuleListItem;
  now: Date;
  menu: ReactNode;
  countdown: ReactNode;
  repliesCount?: number;
  onOpenReplies?: () => void;
  children?: ReactNode;
}

/** Oblò: una riga compatta con l'oblò a sinistra e l'anello di avanzamento verso l'apertura. */
export function CapsulePortholeRow({ capsule, now, menu, countdown, repliesCount = 0, onOpenReplies, children }: PortholeRowProps) {
  const state = capsuleArtState(capsule, now);

  return (
    <li className="relative grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-start gap-4 surface-card rounded-card border border-zinc-200 bg-white p-3 pr-3 shadow-[0_2px_8px_rgba(18,26,53,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(18,26,53,0.12)] sm:grid-cols-[92px_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950">
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
          <h3 className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
            {capsule.title}
          </h3>
          <span className="shrink-0">{menu}</span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{capsuleSubline(capsule)}</p>
        <CapsuleChips capsule={capsule} now={now} repliesCount={repliesCount} onOpenReplies={onOpenReplies} />
        {countdown}
        {children}
      </div>
    </li>
  );
}
