import { cn } from "@/lib/utils";

const DARK_SIZES = {
  sm: { symbol: "h-7 w-7", text: "text-[22px]" },
  md: { symbol: "h-9 w-9", text: "text-[28px]" },
  lg: { symbol: "h-20 w-20", text: "text-[60px]" },
} as const;

/**
 * Il logo con la scritta. Nel tema chiaro è il file ufficiale (logo-lockup.svg); nel tema scuro quella scritta è blu
 * notte e si perde sul fondo (v. revisione fotografica, G4), quindi lì si mostra il simbolo ufficiale con "Hinthial" in
 * testo, Baloo 2 --- il carattere della scritta del logo --- nel colore chiaro `wordmark`. Finché non c'è una variante
 * ufficiale del logo per fondi scuri (v. public/brand/README.md, `logo-dark.svg`), la foglia sulla "i" non c'è.
 * `className` dimensiona il logo del tema chiaro, `darkSize` la versione scura.
 */
export function BrandLockup({ className, darkSize = "sm" }: { className?: string; darkSize?: keyof typeof DARK_SIZES }) {
  const size = DARK_SIZES[darkSize];
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
      <img src="/brand/logo-lockup.svg" alt="HINTHIAL" loading="lazy" className={cn("dark:hidden", className)} />
      <span role="img" aria-label="HINTHIAL" className="hidden items-center gap-2 dark:inline-flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
        <img src="/brand/logo.svg" alt="" loading="lazy" className={cn("shrink-0", size.symbol)} />
        <span
          aria-hidden="true"
          className={cn("font-extrabold leading-none tracking-tight text-wordmark", size.text)}
          style={{ fontFamily: "var(--font-baloo), system-ui, sans-serif" }}
        >
          Hinthial
        </span>
      </span>
    </>
  );
}
