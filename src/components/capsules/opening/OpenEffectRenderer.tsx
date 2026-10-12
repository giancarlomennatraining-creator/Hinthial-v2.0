"use client";

import { EffectDeck } from "@/components/capsules/opening/EffectDeck";
import { EffectDiscreet } from "@/components/capsules/opening/EffectDiscreet";
import { EffectHold } from "@/components/capsules/opening/EffectHold";
import { EffectLight } from "@/components/capsules/opening/EffectLight";
import { EffectZoom } from "@/components/capsules/opening/EffectZoom";
import type { OpenEffectProps } from "@/components/capsules/opening/types";
import type { CapsuleOpenEffect } from "@/domain/capsules/open-effects";

/** Sceglie l'effetto con cui si apre una capsula (v. domain/capsules/open-effects.ts). */
export function OpenEffectRenderer({ effect, ...props }: OpenEffectProps & { effect: CapsuleOpenEffect }) {
  switch (effect) {
    case "zoom":
      return <EffectZoom {...props} />;
    case "hold":
      return <EffectHold {...props} />;
    case "deck":
      return <EffectDeck {...props} />;
    case "light":
      return <EffectLight {...props} />;
    case "discreet":
      return <EffectDiscreet {...props} />;
  }
}
