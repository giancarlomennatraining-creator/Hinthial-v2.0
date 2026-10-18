"use client";

import { useEffect, useState } from "react";
import { EffectShell } from "@/components/capsules/opening/EffectShell";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { OpenedBadge, ReadingPage } from "@/components/capsules/opening/OpenedParts";
import type { OpenEffectProps } from "@/components/capsules/opening/types";
import { cn } from "@/lib/utils";

/**
 * "Sblocco discreto": quasi nessuna scena. La pagina della capsula entra di lato, come qualunque altra pagina dell'app, con la
 * lettera, gli allegati, "La storia di questa capsula" e in fondo il pensiero. È l'effetto di default.
 */
export function EffectDiscreet({ view, slots, onClose }: OpenEffectProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [entered, setEntered] = useState(reduced);

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

  return (
    <EffectShell
      effect="discreet"
      onClose={onClose}
      className={cn(
        "overflow-auto bg-zinc-50 transition-transform duration-[450ms] ease-[cubic-bezier(.3,.9,.3,1)] dark:bg-zinc-950",
        entered ? "translate-x-0" : "translate-x-full",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5 pr-14 sm:p-8 sm:pr-16">
        <button type="button" onClick={onClose} className="w-fit text-sm font-semibold text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400">
          ← Torna alle capsule
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-extrabold text-accent sm:text-3xl">{view.title}</h2>
          <OpenedBadge />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Da {view.ownerName}</p>
        <ReadingPage view={view} slots={slots} withStory />
      </div>
    </EffectShell>
  );
}
