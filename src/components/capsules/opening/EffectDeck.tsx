"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EffectShell } from "@/components/capsules/opening/EffectShell";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { OpenedLetter } from "@/components/capsules/opening/OpenedParts";
import type { OpenEffectProps } from "@/components/capsules/opening/types";
import { cn } from "@/lib/utils";

interface DeckCard {
  key: string;
  title: string;
  hint: string;
  body: ReactNode;
  tone?: "letter";
}

/**
 * "Ricordi uno a uno": dalla capsula escono la lettera e gli allegati come carte da sfogliare, una per volta, e in fondo il
 * pensiero. Le carte escono dall'oblò toccato e si dispongono in mazzo; passando alla successiva, quella davanti esce di lato.
 * Avanti/Indietro, i puntini e le frecce della tastiera.
 */
export function EffectDeck({ view, slots, origin, onClose }: OpenEffectProps) {
  const [reduced] = useState(prefersReducedMotion);
  const deckRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [entered, setEntered] = useState(reduced);
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null);

  const cards: DeckCard[] = [
    { key: "letter", title: "La lettera", hint: view.letterStyle === "handwritten" ? "scritta a mano" : "", tone: "letter", body: <OpenedLetter view={view} large /> },
    ...view.attachments.map((attachment): DeckCard => ({
      key: attachment.id,
      title: attachment.filename,
      hint: "allegato",
      body: <div className="flex flex-col gap-3">{slots.renderAttachment(attachment, "light")}</div>,
    })),
    { key: "reply", title: "Lascia un pensiero", hint: `per ${view.ownerName}`, body: slots.reply },
  ];
  const last = cards.length - 1;

  // Il punto da cui escono le carte, relativo al mazzo.
  useLayoutEffect(() => {
    const deck = deckRef.current?.getBoundingClientRect();
    if (deck && origin) setFrom({ x: origin.x - deck.left, y: origin.y - deck.top });
  }, [origin]);

  useEffect(() => {
    if (reduced) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [reduced]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((i) => Math.min(last, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [last]);

  function cardStyle(i: number): CSSProperties {
    const d = i - index;
    const delay = entered ? 0 : i * 0.07;
    const base: CSSProperties = {
      transformOrigin: from ? `${from.x}px ${from.y}px` : "50% 0%",
      transition: reduced ? "none" : `transform .6s cubic-bezier(.2,.9,.25,1) ${delay}s, opacity .4s ${delay}s`,
    };
    if (!entered) return { ...base, transform: "scale(.08)", opacity: 0, zIndex: 50 - i };
    if (d < 0) return { ...base, transform: "translateX(-130%) rotate(-8deg)", opacity: 0, pointerEvents: "none", zIndex: 50 - i };
    const depth = Math.min(d, 3);
    return { ...base, transform: `translateY(${depth * 12}px) scale(${1 - depth * 0.045})`, opacity: d > 3 ? 0 : 1, zIndex: 50 - i, pointerEvents: d === 0 ? "auto" : "none" };
  }

  return (
    <EffectShell effect="deck" onClose={onClose} className="flex flex-col items-center gap-3 overflow-hidden bg-zinc-50/95 p-4 text-zinc-900 backdrop-blur-md sm:p-6 dark:bg-zinc-950/95 dark:text-zinc-100">
      <div className="flex w-full max-w-md items-center justify-between pr-11">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {index < last ? `Ricordo ${index + 1} di ${last}` : "Per finire"}
        </span>
        <span className="font-heading text-sm font-extrabold">{view.title}</span>
      </div>

      <div ref={deckRef} className="relative my-auto h-[min(520px,72%)] w-full max-w-md">
        {cards.map((card, i) => (
          <section
            key={card.key}
            aria-label={card.title}
            aria-hidden={i !== index}
            style={cardStyle(i)}
            className={cn(
              "absolute inset-x-0 top-0 bottom-3 flex flex-col gap-3 overflow-auto rounded-3xl border p-5 shadow-[0_18px_40px_rgba(18,26,53,0.14)]",
              card.tone === "letter" ? "border-[#EDE1C4] bg-[#FBF6EA]" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
            )}
          >
            <h3 className={cn("flex flex-wrap items-baseline gap-2 font-heading text-lg font-extrabold", card.tone === "letter" && "text-[#3B331F]")}>
              {card.title}
              {card.hint ? <em className="text-[11px] font-medium not-italic text-zinc-500">{card.hint}</em> : null}
            </h3>
            {card.body}
          </section>
        ))}
      </div>

      <div className="flex w-full max-w-md items-center justify-between gap-3">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950"
        >
          Indietro
        </button>
        <span className="flex gap-1.5" aria-hidden="true">
          {cards.map((card, i) => (
            <i key={card.key} className={cn("h-2 w-2 rounded-full transition-all", i === index ? "scale-125 bg-brand" : "bg-zinc-300 dark:bg-zinc-700")} />
          ))}
        </span>
        <button
          type="button"
          onClick={() => (index < last ? setIndex((i) => i + 1) : onClose())}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          {index < last ? "Avanti" : "Fine"}
        </button>
      </div>
    </EffectShell>
  );
}
