import type { CapsuleOpenEffect } from "@/domain/capsules/open-effects";

/** Una piccola icona per ognuno dei cinque effetti di apertura, per riconoscerli a colpo d'occhio (Impostazioni e scelta del mittente). */
export function EffectIcon({ effect, className }: { effect: CapsuleOpenEffect; className?: string }) {
  const common = { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className } as const;

  switch (effect) {
    case "zoom":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="4" />
          <circle cx="16" cy="16" r="9" />
          <circle cx="16" cy="16" r="14" strokeDasharray="2 3" />
        </svg>
      );
    case "hold":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" strokeOpacity=".3" />
          <path d="M16 5a11 11 0 0 1 9.5 16.5" />
          <circle cx="16" cy="16" r="3" />
        </svg>
      );
    case "deck":
      return (
        <svg {...common}>
          <rect x="9" y="6" width="16" height="20" rx="3" strokeOpacity=".4" />
          <rect x="6" y="9" width="16" height="20" rx="3" strokeOpacity=".7" transform="translate(0 -3)" />
          <rect x="3" y="6" width="16" height="20" rx="3" transform="translate(0 0)" />
        </svg>
      );
    case "light":
      return (
        <svg {...common}>
          <circle cx="16" cy="14" r="5" />
          <path d="M16 3v3M16 22v3M5 14H2M30 14h-3M8.2 6.2L6 4M25.8 6.2L28 4M8.2 21.8L6 24M25.8 21.8L28 24" />
        </svg>
      );
    case "discreet":
      return (
        <svg {...common}>
          <rect x="6" y="5" width="20" height="22" rx="3" />
          <path d="M10 11h12M10 16h12M10 21h7" />
        </svg>
      );
  }
}
