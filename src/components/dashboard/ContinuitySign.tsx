import { cn } from "@/lib/utils";

/**
 * Il segno distintivo di Continuità: quanto Hinthial è pronto a far arrivare ciò che sai e ciò che hai a chi resta.
 * Ogni passo fatto è una foglia che si apre sull'albero (Foglia) o una stella che si accende (Notte); in Luce non c'è
 * disegno, resta la barra. Sono due disegni nello stesso posto e li sceglie il CSS in base allo stile attivo (v.
 * `.sig-*` in globals.css), così non dipendono da uno stato React né danno differenze al primo paint.
 *
 * Decorativo (aria-hidden): le stesse informazioni stanno nell'elenco dei passi e nella barra con ruolo `progressbar`.
 * `done[i]` è il passo i-esimo, nell'ordine in cui compaiono nell'elenco; i disegni hanno quattro posti.
 */
export function ContinuitySign({ done }: { done: boolean[] }) {
  const on = (i: number) => done[i] === true;
  return (
    <div className="hidden shrink-0 sm:block">
      <svg aria-hidden="true" viewBox="0 0 210 150" className="sig sig-foglia h-[150px] w-[210px]">
        <g fill="none" strokeLinecap="round" className="stroke-zinc-500">
          <path d="M105 140 C103 110 108 90 104 52" strokeWidth="4" />
          <path d="M105 112 C88 104 78 96 72 84" strokeWidth="3" />
          <path d="M104 86 C122 80 134 72 140 60" strokeWidth="3" />
          <path d="M104 62 C92 56 86 48 84 38" strokeWidth="2.6" />
        </g>
        {LEAVES.map((d, i) => (
          <path
            key={i}
            d={d}
            style={{ "--i": i } as React.CSSProperties}
            className={cn(
              "stroke-[1.4]",
              on(i) ? "sig-leaf-on fill-brand stroke-brand" : "fill-none stroke-zinc-400 [stroke-dasharray:3_3]",
            )}
          />
        ))}
      </svg>
      <svg aria-hidden="true" viewBox="0 0 210 150" className="sig sig-notte h-[150px] w-[210px]">
        {STARS.map(([x, y], i) => (
          <line
            key={`l${i}`}
            x1="105"
            y1="78"
            x2={x}
            y2={y}
            style={{ "--i": i } as React.CSSProperties}
            className={cn("stroke-[1.2]", on(i) ? "sig-line-on stroke-accent" : "stroke-zinc-300 dark:stroke-zinc-700")}
          />
        ))}
        {STARS.map(([x, y], i) => (
          <circle
            key={`s${i}`}
            cx={x}
            cy={y}
            r={on(i) ? 6 : 4.5}
            style={{ "--i": i } as React.CSSProperties}
            className={cn(on(i) ? "sig-star-on fill-accent [filter:drop-shadow(0_0_6px_var(--accent))]" : "fill-zinc-400 opacity-60")}
          />
        ))}
        <circle cx="105" cy="78" r="9" className="fill-accent [filter:drop-shadow(0_0_8px_var(--accent))]" />
        <text x="105" y="100" textAnchor="middle" className="fill-zinc-500 text-[11px]" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
          tu
        </text>
      </svg>
    </div>
  );
}

/** Le quattro foglie dell'albero, dalla più bassa alla più alta, e le quattro stelle intorno a "tu". */
const LEAVES = [
  "M72 84 C60 82 52 74 52 64 C64 64 72 70 72 84Z",
  "M140 60 C152 58 160 50 160 40 C148 40 140 46 140 60Z",
  "M84 38 C74 34 70 26 72 18 C82 20 86 28 84 38Z",
  "M104 52 C116 48 120 38 118 28 C108 30 102 38 104 52Z",
];
const STARS: [number, number][] = [
  [56, 38],
  [162, 34],
  [176, 104],
  [66, 120],
];
