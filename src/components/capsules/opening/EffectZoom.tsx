"use client";

import { useEffect, useState } from "react";
import { EffectShell } from "@/components/capsules/opening/EffectShell";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { OpenedBadge, ReadingPage } from "@/components/capsules/opening/OpenedParts";
import type { OpenEffectProps, OpenOrigin } from "@/components/capsules/opening/types";
import { cn } from "@/lib/utils";

const WHEEL = (
  <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="7" />
    <circle cx="50" cy="50" r="9" fill="#fff" />
    <g stroke="#fff" strokeWidth="6" strokeLinecap="round">
      <path d="M50 14v22M50 64v22M14 50h22M64 50h22M24.5 24.5l15.5 15.5M60 60l15.5 15.5M24.5 75.5L40 60M60 40l15.5-15.5" />
    </g>
  </svg>
);

/**
 * "Zoom nell'oblò": l'oblò toccato si allarga fino a coprire la pagina (un cerchio che cresce da lì), il volantino del portello
 * gira e dal centro sale la luce, che diventa lo sfondo della pagina di lettura. Passi: 0 l'oblò si allarga, 1 il volantino
 * compare, 2 gira e la luce sale, 3 la pagina di lettura.
 */
export function EffectZoom({ view, slots, origin, onClose }: OpenEffectProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [start] = useState<OpenOrigin>(() => origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2, r: 40 });
  const [big] = useState(() => Math.hypot(window.innerWidth, window.innerHeight) * 1.1);
  const [expanded, setExpanded] = useState(reduced);
  const [step, setStep] = useState(reduced ? 3 : 0);

  useEffect(() => {
    if (reduced) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setExpanded(true));
    });
    const timers = [setTimeout(() => setStep(1), 650), setTimeout(() => setStep(2), 1050), setTimeout(() => setStep(3), 2150)];
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      timers.forEach(clearTimeout);
    };
  }, [reduced]);

  return (
    <EffectShell
      effect="zoom"
      onClose={onClose}
      closeTone={step === 3 ? "light" : "dark"}
      className="overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#4d6fd0,#1b3796_52%,#0c1c5c)] text-white"
      style={{
        clipPath: `circle(${expanded ? big : start.r}px at ${start.x}px ${start.y}px)`,
        transition: reduced ? "none" : "clip-path .8s cubic-bezier(.6,0,.2,1)",
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-[42%] -ml-[95px] -mt-[95px] h-[190px] w-[190px] transition-all duration-1000 ease-[cubic-bezier(.5,0,.2,1)]",
          step === 0 && "scale-90 opacity-0",
          step === 1 && "opacity-100",
          step === 2 && "rotate-[200deg] scale-[1.15] opacity-100",
          step === 3 && "rotate-[200deg] scale-[2] opacity-0",
        )}
      >
        {WHEEL}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 top-[42%] -ml-[5px] -mt-[5px] h-[10px] w-[10px] rounded-full bg-zinc-50 transition-transform duration-1000 ease-[cubic-bezier(.6,0,.3,1)]",
          step >= 2 ? "scale-[420]" : "scale-0",
        )}
      />
      <p className={cn("absolute inset-x-0 bottom-[14%] text-center text-sm font-semibold transition-opacity duration-500", step === 3 ? "opacity-0" : "opacity-90")}>
        Si apre il portello…
      </p>

      <div
        className={cn(
          "absolute inset-0 flex flex-col gap-4 overflow-auto bg-zinc-50 p-5 pr-14 text-zinc-900 transition-opacity duration-[600ms] sm:p-8 sm:pr-16 dark:bg-zinc-950 dark:text-zinc-100",
          step === 3 ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <OpenedBadge>Aperta</OpenedBadge>
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Da {view.ownerName}, per te</p>
            <h2 className="text-2xl font-extrabold sm:text-3xl">{view.title}</h2>
          </div>
          <ReadingPage view={view} slots={slots} />
        </div>
      </div>
    </EffectShell>
  );
}
