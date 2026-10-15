"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SEED_STEPS, activeSeedStep } from "@/components/landing/landing-content";
import { cn } from "@/lib/utils";

const LEAF_SMALL = "M0 0 C 7 -10, 21 -10, 28 0 C 21 10, 7 10, 0 0Z";
const LEAF = "M0 0 C 10 -14, 30 -14, 40 0 C 30 14, 10 14, 0 0Z";

/** Variabili CSS in linea (ritardi, spostamenti delle foglie): React non le tipizza. */
function vars(values: Record<string, string>): CSSProperties {
  return values as CSSProperties;
}

/**
 * "Il seme": mentre si scorre, il seme (Hinthia) germoglia, l'albero si riempie di foglie (racconti e documenti), compaiono le
 * persone e alcune foglie volano da chi deve riceverle. Lo stato è solo il passo attivo (0-4): tutto il resto lo fanno le
 * transizioni CSS di landing.css. Il testo dei passi è sempre nella pagina, il disegno è decorazione.
 */
export function SeedStory() {
  const [step, setStep] = useState(0);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const tops = stepRefs.current.map((el) => el?.getBoundingClientRect().top ?? Infinity);
      setStep(activeSeedStep(tops, window.innerHeight * 0.6));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const stageClass = cn("lp-stage", step >= 1 && "s1", step >= 2 && "s2", step >= 3 && "s3", step >= 4 && "s4");

  return (
    <section id="come-cresce" aria-labelledby="seed-title" className="border-t border-[var(--lp-line)] px-4 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 pt-14 text-center">
        <p className="lp-hand text-2xl text-[var(--lp-green)]">come cresce</p>
        <h2 id="seed-title" className="lp-title text-3xl sm:text-4xl">
          Dal seme alle persone che ami
        </h2>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-10 md:grid-cols-2">
        <div className={stageClass}>
          <svg viewBox="0 0 400 400" aria-hidden="true">
            <defs>
              <linearGradient id="lp-g-trunk" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#0b2f9e" />
                <stop offset=".6" stopColor="#1b5fe3" />
                <stop offset="1" stopColor="#15b3d4" />
              </linearGradient>
              <linearGradient id="lp-g-leaf" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#15b3d4" />
                <stop offset=".5" stopColor="#47c25b" />
                <stop offset="1" stopColor="#8bdc4f" />
              </linearGradient>
            </defs>
            <ellipse className="lp-soil" cx="200" cy="362" rx="130" ry="12" />
            <path className="lp-trunk" pathLength={1} d="M200 340 C 197 300, 205 262, 200 222 S 195 150, 200 110" />
            <path className="lp-branch" pathLength={1} d="M200 272 C 180 258, 160 250, 128 238" />
            <path className="lp-branch" pathLength={1} d="M201 240 C 222 226, 246 220, 276 206" />
            <path className="lp-branch" pathLength={1} d="M199 192 C 182 172, 165 160, 140 150" />
            <path className="lp-branch" pathLength={1} d="M200 170 C 220 150, 240 140, 262 126" />
            <path className="lp-branch" pathLength={1} d="M200 112 C 200 98, 200 88, 200 74" />

            <g className="lp-sprout">
              <g transform="translate(200 268) rotate(-140)">
                <path d="M0 0 C 6 -9, 18 -9, 24 0 C 18 9, 6 9, 0 0Z" fill="url(#lp-g-leaf)" />
              </g>
              <g transform="translate(200 268) rotate(-40)">
                <path d="M0 0 C 6 -9, 18 -9, 24 0 C 18 9, 6 9, 0 0Z" fill="url(#lp-g-leaf)" />
              </g>
            </g>

            {/* Foglie piccole: restano sull'albero. */}
            <g transform="translate(166 252) rotate(150)">
              <path className="lp-leaf" style={vars({ "--d": ".1s" })} d={LEAF_SMALL} />
            </g>
            <g transform="translate(236 224) rotate(-50)">
              <path className="lp-leaf" style={vars({ "--d": ".2s" })} d={LEAF_SMALL} />
            </g>
            <g transform="translate(176 168) rotate(-130)">
              <path className="lp-leaf" style={vars({ "--d": ".3s" })} d={LEAF_SMALL} />
            </g>
            <g transform="translate(228 146) rotate(-60)">
              <path className="lp-leaf" style={vars({ "--d": ".35s" })} d={LEAF_SMALL} />
            </g>

            {/* Foglie grandi: tre volano dalla loro persona all'ultimo passo. */}
            <g transform="translate(128 238) rotate(195)">
              <path className="lp-leaf" style={vars({ "--d": ".4s" })} d={LEAF} />
            </g>
            <g className="lp-fly" style={vars({ "--dx": "68px", "--dy": "114px" })}>
              <g transform="translate(276 206) rotate(-15)">
                <path className="lp-leaf" style={vars({ "--d": ".5s" })} d={LEAF} />
              </g>
            </g>
            <g className="lp-fly" style={vars({ "--dx": "-92px", "--dy": "-84px" })}>
              <g transform="translate(140 150) rotate(205)">
                <path className="lp-leaf" style={vars({ "--d": ".6s" })} d={LEAF} />
              </g>
            </g>
            <g className="lp-fly" style={vars({ "--dx": "-210px", "--dy": "192px" })}>
              <g transform="translate(262 126) rotate(-30)">
                <path className="lp-leaf" style={vars({ "--d": ".7s" })} d={LEAF} />
              </g>
            </g>
            <g transform="translate(200 74) rotate(-90)">
              <path className="lp-leaf" style={vars({ "--d": ".8s" })} d={LEAF} />
            </g>

            <LeafTag x={56} y={250} width={104} label="Ricetta del ragù" />
            <LeafTag x={262} y={232} width={92} label="Polizza casa" goes />
            <LeafTag x={66} y={112} width={150} label="Come ci siamo conosciuti" goes />
            <LeafTag x={232} y={96} width={114} label="Lettera per Giulia" goes />
            <LeafTag x={148} y={34} width={112} label="Istruzioni caldaia" />

            <Person cx={52} cy={318} initial="G" name="Giulia" when="14·06·2031" delay="0s" />
            <Person cx={348} cy={318} initial="P" name="Paolo" when="eredità" delay=".15s" />
            <Person cx={48} cy={62} initial="L" name="Luca" when="Natale" delay=".3s" />

            <image href="/brand/hinthia/hinthia-128.webp" x="176" y="320" width="48" height="48" />
          </svg>
          <span className="lp-hint" aria-hidden="true">
            scorri ↓
          </span>
        </div>

        <ol className="flex flex-col">
          {SEED_STEPS.map((s, i) => (
            <li key={s.title}>
              <div
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={cn(
                  "lp-step flex flex-col justify-center gap-2.5 py-10",
                  i === SEED_STEPS.length - 1 ? "min-h-[70vh] md:min-h-[90vh]" : "min-h-[60vh] md:min-h-[72vh]",
                  step === i + 1 && "on",
                )}
              >
                <span className="lp-mono text-xs tracking-widest text-[var(--lp-blue)] uppercase">{s.section}</span>
                <h3 className="lp-title text-3xl leading-tight sm:text-4xl">{s.title}</h3>
                <p className="lp-muted max-w-[40ch] text-lg">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function LeafTag({ x, y, width, label, goes }: { x: number; y: number; width: number; label: string; goes?: boolean }) {
  return (
    <g className={cn("lp-tag", goes && "lp-goes")}>
      <rect x={x} y={y} width={width} height={22} rx={11} />
      <text x={x + width / 2} y={y + 15} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function Person({ cx, cy, initial, name, when, delay }: { cx: number; cy: number; initial: string; name: string; when: string; delay: string }) {
  return (
    <g className="lp-person" style={{ transitionDelay: delay }}>
      <circle className="lp-ring" cx={cx} cy={cy} r={22} />
      <circle className="lp-face" cx={cx} cy={cy} r={22} />
      <text x={cx} y={cy + 6} fontSize={15}>
        {initial}
      </text>
      <text x={cx} y={cy + 40} fontSize={13}>
        {name}
      </text>
      <text className="lp-when" x={cx} y={cy + 56}>
        {when}
      </text>
    </g>
  );
}
