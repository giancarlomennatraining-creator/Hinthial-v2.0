"use client";

import type { ReactNode } from "react";
import { capsuleArtState } from "@/components/capsules/CapsuleArt";
import { CapsuleChips, capsuleSubline } from "@/components/capsules/CapsuleCardParts";
import type { CapsuleListItem, CapsuleStatus } from "@/domain/capsules/types";

const BAND_COLOR: Record<CapsuleStatus, string> = {
  draft: "bg-zinc-100 dark:bg-zinc-900",
  ready: "bg-[#e8edfc] dark:bg-brand/15",
  shared: "bg-[#e3f4ec] dark:bg-green-950",
};

/** Le due linee oblique che fanno sembrare la fascia superiore la patta di una busta. */
const FLAP_LINES =
  "linear-gradient(to bottom right, transparent 49.4%, rgba(138,145,173,.35) 49.4%, rgba(138,145,173,.35) 50.6%, transparent 50.6%), linear-gradient(to bottom left, transparent 49.4%, rgba(138,145,173,.35) 49.4%, rgba(138,145,173,.35) 50.6%, transparent 50.6%)";

function SealIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Il sigillo sulla patta: rosso se la capsula è chiusa, verde se si può già aprire, tratteggiato con una penna se è ancora una bozza. */
function Seal({ status, opened }: { status: CapsuleStatus; opened: boolean }) {
  const common = "absolute -bottom-3.5 left-4 flex h-[30px] w-[30px] items-center justify-center rounded-full";

  if (status === "draft") {
    return (
      <span className={`${common} border-[1.5px] border-dashed border-[#8a91ad] bg-white text-[#8a91ad] dark:bg-zinc-950`} aria-hidden="true">
        <SealIcon>
          <path d="m4 20 1-4L16 5l3 3L8 19z" />
        </SealIcon>
      </span>
    );
  }
  return (
    <span
      className={`${common} text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] ${opened ? "bg-[#1c7c5a]" : "bg-[#b3302f]"}`}
      aria-hidden="true"
    >
      <SealIcon>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d={opened ? "M8 11V8a4 4 0 0 1 7-2.6" : "M8 11V8a4 4 0 0 1 8 0v3"} />
      </SealIcon>
    </span>
  );
}

/**
 * Una capsula dell'elenco, come una busta (lo stile "Buste"): la patta in alto con il sigillo, il titolo, per chi è e quando
 * si apre. Per una bozza dice cosa le manca per essere chiusa. Il menu delle azioni, il conto alla rovescia e i contenuti
 * (allegati con "Apri" e "Trascrizione") li passa chi la disegna, perché dipendono dallo stato della pagina.
 */
export function CapsuleCard({
  capsule,
  now,
  menu,
  countdown,
  repliesCount = 0,
  onOpenReplies,
  children,
}: {
  capsule: CapsuleListItem;
  now: Date;
  menu: ReactNode;
  /** Il conto alla rovescia, se la capsula non è una bozza e l'utente non l'ha nascosto. */
  countdown: ReactNode;
  /** Quanti pensieri hanno lasciato i destinatari, e come leggerli. */
  repliesCount?: number;
  onOpenReplies?: () => void;
  /** I contenuti allegati, con le loro azioni. */
  children?: ReactNode;
}) {
  const opened = capsuleArtState(capsule, now) === "ready";

  return (
    <li className="relative flex min-w-0 flex-col rounded-[18px] border border-[#dfe3f0] bg-white shadow-[0_2px_8px_rgba(18,26,53,0.05)] dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={`relative flex h-14 items-start justify-end rounded-t-[17px] border-b border-[#dfe3f0] p-2 dark:border-zinc-800 ${BAND_COLOR[capsule.status]}`}
        style={{ backgroundImage: FLAP_LINES }}
      >
        <span className="relative z-10">{menu}</span>
        <Seal status={capsule.status} opened={opened} />
      </div>

      <div className="flex flex-col gap-2.5 p-4 pt-6">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-[17px] leading-tight font-extrabold tracking-[-0.01em] text-[#121a35] dark:text-zinc-100">
            {capsule.title}
          </h3>
          <p className="text-xs text-[#5b6483] dark:text-zinc-400">{capsuleSubline(capsule)}</p>
        </div>

        <CapsuleChips capsule={capsule} now={now} repliesCount={repliesCount} onOpenReplies={onOpenReplies} />

        {countdown}
        {children}
      </div>
    </li>
  );
}
