"use client";

import type { ReactNode, Ref } from "react";
import { CapsuleArt, type CapsuleArtState } from "@/components/capsules/CapsuleArt";
import { cn } from "@/lib/utils";

/**
 * L'oblò: un vetro blu in una cornice rotonda, con la capsula dentro e un anello attorno che si riempie man mano che la data di
 * apertura si avvicina (blu mentre aspetta, verde quando si può aprire). Lo usano lo stile "Oblò" dell'elenco, le capsule
 * condivise con me, le anteprime delle Impostazioni e le aperture "Zoom nell'oblò" e "Tieni premuto".
 */
export function CapsulePorthole({
  state,
  progress,
  className,
  glassClassName,
  label,
  ref,
  children,
}: {
  state: CapsuleArtState;
  /** Da 0 a 1: quanto dell'anello è pieno. Una capsula apribile è sempre piena. */
  progress: number;
  /** La misura (di default 92px) e ogni altra classe del contenitore: se si passa, sostituisce la misura di default (cn non risolve i conflitti tra classi). */
  className?: string;
  glassClassName?: string;
  /** Una frase per chi non vede l'anello (es. "Trascorso il 12% del tempo"). */
  label?: string;
  ref?: Ref<HTMLSpanElement>;
  /** Sopra al vetro: es. l'anello di pressione e il volantino di "Tieni premuto". */
  children?: ReactNode;
}) {
  const pr = state === "ready" ? 1 : Math.max(0, Math.min(1, progress));
  const ring = state === "ready" ? "#2FD27E" : "#2B4FC4";

  return (
    <span
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      title={label}
      className={cn("relative block shrink-0", className ?? "h-[92px] w-[92px]")}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="22" cy="22" r="20" fill="none" stroke="#D3DDF5" strokeWidth="4.5" />
        {state !== "draft" ? (
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            stroke={ring}
            strokeWidth="4.5"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="100 100"
            strokeDashoffset={100 - Math.max(pr * 100, state === "sealed" ? 3 : 0)}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)" }}
          />
        ) : null}
      </svg>
      <span
        className={cn(
          "absolute inset-[10%] grid place-items-center overflow-hidden rounded-full",
          state === "draft"
            ? "bg-[#EEF1F8] shadow-[inset_0_0_0_4px_#D7DDEC,inset_0_0_0_6px_#C0C8DD]"
            : "bg-[radial-gradient(circle_at_35%_28%,#5d7fd6,#1d3a96_60%,#0f2160)] shadow-[inset_0_0_0_4px_#B7C4E6,inset_0_0_0_6px_#7F93C4,inset_0_6px_14px_rgba(0,0,0,.35)]",
          glassClassName,
        )}
      >
        <CapsuleArt variant="steel" state={state} className={cn("w-[64%] -rotate-12", state === "draft" && "opacity-35 grayscale")} />
        <span
          aria-hidden="true"
          className="absolute left-[14%] top-[10%] h-[26%] w-[44%] -rotate-[24deg] rounded-full bg-gradient-to-b from-white/50 to-transparent"
        />
      </span>
      {children}
    </span>
  );
}
