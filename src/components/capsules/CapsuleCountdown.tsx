"use client";

import { useEffect, useRef } from "react";
import { computeCountdown, computeCountdownParts } from "@/lib/capsule-countdown";
import { useCountdownTick } from "@/lib/use-countdown-tick";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "lg";

function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

const BOX_CLASS: Record<Size, string> = {
  xs: "h-7 w-5",
  sm: "h-11 w-8",
  lg: "h-20 w-14",
};

const ROUNDED_CLASS: Record<Size, string> = {
  xs: "rounded",
  sm: "rounded-md",
  lg: "rounded-xl",
};

const DIGIT_TEXT_CLASS: Record<Size, string> = {
  xs: "text-[11px]",
  sm: "text-lg",
  lg: "text-4xl",
};

const GAP_CLASS: Record<Size, string> = {
  xs: "gap-1",
  sm: "gap-1.5",
  lg: "gap-2.5",
};

const FACE_CLASS =
  "absolute inset-0 flex items-center justify-center border border-zinc-200 bg-white font-extrabold tabular-nums text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50";

/**
 * Un "cartellino" che scatta (flip meccanico) invece di limitarsi a
 * cambiare il numero --- ma solo per giorni/ore/minuti: sui secondi il
 * flip risulterebbe frenetico invece che piacevole, dato che scattano
 * ogni singolo secondo (v. discussione con l'utente sul prototipo
 * Claude Design) --- lì (canFlip=false) il numero si limita a cambiare.
 * Scrive il testo direttamente sul DOM via ref invece di affidarsi al
 * solo stato React, per controllare con precisione l'istante in cui il
 * valore passa dal vecchio al nuovo rispetto alla transizione CSS (v.
 * onEnd sotto) --- lo stesso schema già validato nel prototipo.
 */
function FlipUnit({ value, label, size, canFlip }: { value: number; label: string; size: Size; canFlip: boolean }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<string | null>(null);

  useEffect(() => {
    const text = pad2(value);
    const inner = innerRef.current;
    const front = frontRef.current;
    const back = backRef.current;
    if (!inner || !front || !back) return;

    if (currentRef.current === null) {
      front.textContent = text;
      back.textContent = text;
      currentRef.current = text;
      return;
    }
    if (currentRef.current === text) return;
    currentRef.current = text;

    if (!canFlip) {
      front.textContent = text;
      back.textContent = text;
      return;
    }

    back.textContent = text;
    inner.style.transition = "transform .5s cubic-bezier(.4,0,.2,1)";
    inner.style.transform = "rotateX(180deg)";

    function onEnd() {
      if (!inner || !front || !back) return;
      inner.removeEventListener("transitionend", onEnd);
      inner.style.transition = "none";
      inner.style.transform = "rotateX(0deg)";
      front.textContent = text;
      back.textContent = text;
      inner.getBoundingClientRect(); // forza il reflow prima di riattivare la transizione
      inner.style.transition = "";
    }
    inner.addEventListener("transitionend", onEnd);
  }, [value, canFlip]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("relative shrink-0", BOX_CLASS[size])} style={{ perspective: 240 }}>
        <div ref={innerRef} className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }}>
          <div
            ref={frontRef}
            aria-hidden="true"
            className={cn(FACE_CLASS, ROUNDED_CLASS[size], DIGIT_TEXT_CLASS[size])}
            style={{ backfaceVisibility: "hidden" }}
          />
          <div
            ref={backRef}
            aria-hidden="true"
            className={cn(FACE_CLASS, ROUNDED_CLASS[size], DIGIT_TEXT_CLASS[size])}
            style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
          />
        </div>
        {/* Riga centrale, solo decorativa --- richiama il cartellino meccanico del prototipo. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-px bg-black/10 dark:bg-white/10"
        />
      </div>
      {size !== "xs" ? (
        <span className="text-[8px] font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Countdown visivo verso l'apertura di una capsula --- cartellini a
 * flip invece di testo/barra (v. prototipo Claude Design concordato con
 * l'utente). Mostrato solo per le capsule non più in bozza (v.
 * CapsulesPanel.tsx) --- su una bozza openAt può ancora cambiare, un
 * conto alla rovescia non avrebbe senso.
 *
 * L'etichetta di accessibilità (aria-label) resta quella "arrotondata"
 * di computeCountdown, non ricalcolata al secondo come i cartellini
 * stessi --- annunciarla di nuovo a ogni tick sarebbe fastidioso per chi
 * usa uno screen reader; i cartellini sono marcati aria-hidden, decorativi.
 */
export function CapsuleCountdown({
  createdAt,
  openAt,
  size = "sm",
  showProgress = false,
}: {
  createdAt: string;
  openAt: string;
  size?: Size;
  showProgress?: boolean;
}) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const parts = computeCountdownParts(openAt);
  const { label, progressPercent } = computeCountdown(createdAt, openAt);
  // Il tick condiviso forza solo un ri-render al secondo --- i valori
  // sopra vengono comunque ricalcolati leggendo l'orologio reale a ogni
  // render, mai letti dal tick stesso (v. use-countdown-tick.ts).
  useCountdownTick(!parts.isPast);

  if (parts.isPast) {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1 text-xs font-semibold text-lime-800 dark:bg-lime-950 dark:text-lime-300">
        🔓 Disponibile da adesso
      </span>
    );
  }

  // Oltre i 100 giorni un cartellino a 2 cifre non basta --- un numero
  // secco è più leggibile di quattro cartellini quasi sempre fermi (v.
  // prototipo Claude Design, "casi limite").
  if (parts.days >= 100) {
    return (
      <span
        role="img"
        aria-label={label}
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
      >
        🕐 {parts.days}
        <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          giorni
        </span>
      </span>
    );
  }

  const canFlip = !prefersReducedMotion;

  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} className={cn("flex items-end", GAP_CLASS[size])}>
        <FlipUnit value={parts.days} label="giorni" size={size} canFlip={canFlip} />
        <FlipUnit value={parts.hours} label="ore" size={size} canFlip={canFlip} />
        <FlipUnit value={parts.minutes} label="min" size={size} canFlip={canFlip} />
        {/* I secondi non fanno mai il flip meccanico --- v. FlipUnit sopra. */}
        <FlipUnit value={parts.seconds} label="sec" size={size} canFlip={false} />
      </div>
      {showProgress ? (
        <span
          aria-hidden="true"
          className="h-[3px] max-w-[220px] overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <span className="block h-full rounded-full bg-brand transition-[width]" style={{ width: `${progressPercent}%` }} />
        </span>
      ) : null}
    </div>
  );
}
