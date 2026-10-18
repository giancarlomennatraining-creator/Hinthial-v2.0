"use client";

import { useEffect, useRef, useState } from "react";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { EffectShell } from "@/components/capsules/opening/EffectShell";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { OpenedBadge, ReadingPage } from "@/components/capsules/opening/OpenedParts";
import type { OpenEffectProps } from "@/components/capsules/opening/types";
import { cn } from "@/lib/utils";

const HOLD_MS = 1100;

const WHEEL = (
  <svg viewBox="0 0 100 100" aria-hidden="true" className="h-full w-full drop-shadow-[0_0_6px_rgba(0,0,0,.4)]">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="7" />
    <circle cx="50" cy="50" r="9" fill="#fff" />
    <g stroke="#fff" strokeWidth="6" strokeLinecap="round">
      <path d="M50 14v22M50 64v22M14 50h22M64 50h22M24.5 24.5l15.5 15.5M60 60l15.5 15.5M24.5 75.5L40 60M60 40l15.5-15.5" />
    </g>
  </svg>
);

/**
 * "Tieni premuto": al centro c'è l'oblò, e per aprire lo si tiene premuto finché l'anello si riempie (il volantino gira). Se si
 * lascia prima, l'anello torna indietro. A fine corsa una spunta verde, poi la capsula si legge in un foglio che sale dal basso
 * (sul telefono) o in un pannello da destra. Da tastiera basta Invio.
 */
export function EffectHold({ view, slots, onClose }: OpenEffectProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const raf = useRef(0);
  const startedAt = useRef(0);
  const holding = useRef(false);
  const progressRef = useRef(0);

  function update(p: number) {
    progressRef.current = p;
    setProgress(p);
  }

  function finish() {
    holding.current = false;
    cancelAnimationFrame(raf.current);
    update(1);
    setDone(true);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {
        // Nessuna vibrazione.
      }
    }
  }

  function tick(now: number) {
    if (!holding.current) return;
    const p = Math.min(1, (now - startedAt.current) / HOLD_MS);
    update(p);
    if (p >= 1) finish();
    else raf.current = requestAnimationFrame(tick);
  }

  function begin() {
    if (done) return;
    holding.current = true;
    startedAt.current = performance.now() - progressRef.current * HOLD_MS;
    raf.current = requestAnimationFrame(tick);
  }

  function release() {
    if (!holding.current) return;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    const back = () => {
      if (holding.current || done) return;
      const next = progressRef.current - 0.06;
      if (next <= 0) {
        update(0);
        return;
      }
      update(next);
      raf.current = requestAnimationFrame(back);
    };
    raf.current = requestAnimationFrame(back);
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Dopo la spunta si apre il foglio (subito se si riduce il movimento).
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setSheetOpen(true), reduced ? 0 : 500);
    return () => clearTimeout(t);
  }, [done, reduced]);

  return (
    <EffectShell effect="hold" onClose={onClose} closeTone={sheetOpen ? "light" : "dark"} className="bg-[#0b1230]/80 backdrop-blur-sm">
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white transition-opacity duration-500", sheetOpen && "opacity-30")}>
        <div
          role="button"
          tabIndex={0}
          aria-label="Tieni premuto per aprire la capsula"
          onPointerDown={begin}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!done) finish();
            }
          }}
          className="relative cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ transform: `scale(${1 - progress * 0.05})`, transition: "transform .15s" }}
        >
          <CapsulePorthole state="ready" progress={1} className="h-[190px] w-[190px]">
            <svg viewBox="0 0 44 44" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray="100 100"
                strokeDashoffset={100 - progress * 100}
              />
            </svg>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid place-items-center"
              style={{ opacity: done ? 0 : progress, transform: `rotate(${progress * 220}deg)`, transition: done ? "opacity .3s" : "none" }}
            >
              <span className="block h-[84px] w-[84px]">{WHEEL}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 grid place-items-center transition-all duration-300 ease-[cubic-bezier(.3,1.6,.5,1)]",
                done ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#2FD27E] text-2xl text-white shadow-[0_0_0_6px_rgba(47,210,126,.3)]">✓</span>
            </span>
          </CapsulePorthole>
        </div>
        <div>
          <p className="font-heading text-xl font-extrabold">{view.title}</p>
          <p className="mt-1 text-sm text-white/80">{done ? "Aperta!" : `Da ${view.ownerName}. Tieni premuto l'oblò per aprire.`}</p>
          {!done ? <p className="mt-1 text-xs text-white/60">Da tastiera: premi Invio.</p> : null}
        </div>
      </div>

      <div
        className={cn(
          "absolute bottom-0 inset-x-0 flex h-[82%] flex-col gap-3 overflow-auto rounded-t-3xl bg-zinc-50 p-4 pt-3 text-zinc-900 shadow-[0_-20px_50px_rgba(8,16,50,.3)] transition-transform duration-[550ms] ease-[cubic-bezier(.2,.9,.25,1)] dark:bg-zinc-950 dark:text-zinc-100",
          "md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[440px] md:rounded-l-3xl md:rounded-tr-none",
          sheetOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full",
        )}
      >
        <span aria-hidden="true" className="mx-auto h-1.5 w-11 shrink-0 rounded-full bg-zinc-300 md:hidden dark:bg-zinc-700" />
        <div className="flex flex-col gap-1 pr-10">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Da {view.ownerName}, per te</p>
          <h2 className="text-2xl font-extrabold">{view.title}</h2>
          <span>
            <OpenedBadge />
          </span>
        </div>
        <ReadingPage view={view} slots={slots} compact />
      </div>
    </EffectShell>
  );
}
