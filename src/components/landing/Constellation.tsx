"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONSTELLATION_FIRST_YEAR,
  CONSTELLATION_LAST_YEAR,
  CONSTELLATION_PEOPLE,
  deliveryStatus,
  isDelivered,
} from "@/components/landing/landing-content";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { cn } from "@/lib/utils";

const PLAY_STEP_MS = 520;
const PULSE_MS = 1000;
const WAVE_MS = 1400;

interface Star {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

interface Point {
  x: number;
  y: number;
}

/** Stelle sempre nello stesso posto (generatore con seme fisso), così il cielo non cambia a ogni visita. */
function makeStars(count: number): Star[] {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: count }, () => ({ x: rnd(), y: rnd(), r: rnd() * 1.4 + 0.3, speed: rnd() * 1.5 + 0.4, phase: rnd() * 6.28 }));
}

/**
 * "Costellazione": Hinthia al centro, intorno le persone d'esempio. Si fanno scorrere gli anni (o "Fai scorrere il tempo") e
 * ogni capsula parte come un impulso di luce quando arriva la sua data; "Se un giorno non rispondo più" mostra cosa consegna
 * l'Eredità digitale. Il disegno è un canvas decorativo: l'elenco sotto dice le stesse cose in testo.
 */
export function Constellation() {
  const [year, setYear] = useState(CONSTELLATION_FIRST_YEAR);
  const [legacy, setLegacy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState<{ index: number; x: number; y: number } | null>(null);

  const skyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stars = useMemo(() => makeStars(220), []);
  const state = useRef({ year, legacy, hover: -1 });
  const deliveredAt = useRef(new Map<number, number>());
  const positions = useRef<Point[]>([]);
  const drawRef = useRef<(now: number) => void>(() => {});
  const reducedRef = useRef(false);

  // Il disegno: dimensioni, ciclo di animazione (solo quando la sezione si vede) e, con il movimento ridotto, un disegno fermo.
  useEffect(() => {
    const canvas = canvasRef.current;
    const sky = skyRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !sky || !ctx) return;
    const reduced = prefersReducedMotion();
    reducedRef.current = reduced;
    const css = getComputedStyle(document.documentElement);
    const headFont = css.getPropertyValue("--font-baloo").trim() || "sans-serif";
    const monoFont = css.getPropertyValue("--font-geist-mono").trim() || "monospace";
    const hinthia = new Image();
    hinthia.src = "/brand/hinthia/hinthia-128.webp";
    let width = 0;
    let height = 0;
    let raf = 0;
    const start = performance.now();

    function resize() {
      const rect = sky!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const c = ctx!;
      const { year: y, legacy: l, hover } = state.current;
      const cx = width / 2;
      const cy = height / 2;
      // Raggi diversi in orizzontale e in verticale, con margine per i nomi: sul telefono nessuna etichetta esce dal bordo.
      const rx = Math.min(width / 2 - 56, height * 0.45);
      const ry = Math.min(height / 2 - 56, width * 0.4);
      positions.current = CONSTELLATION_PEOPLE.map((_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3 + 0.25;
        return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
      });
      const elapsed = reduced ? Number.POSITIVE_INFINITY : now - start;
      c.clearRect(0, 0, width, height);

      for (const s of stars) {
        const alpha = reduced ? 0.6 : 0.25 + 0.75 * Math.abs(Math.sin((now / 1000) * s.speed + s.phase));
        c.fillStyle = `rgba(200,215,255,${alpha})`;
        c.beginPath();
        c.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        c.fill();
      }

      // La costellazione: linee tenui tra persone vicine, disegnate dopo i raggi.
      c.lineWidth = 1;
      positions.current.forEach((p, i) => {
        const q = positions.current[(i + 1) % positions.current.length];
        const progress = Math.min(1, Math.max(0, (elapsed - 1400 - i * 120) / 700));
        if (progress <= 0) return;
        c.strokeStyle = "rgba(122,162,255,.16)";
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x + (q.x - p.x) * progress, p.y + (q.y - p.y) * progress);
        c.stroke();
      });

      CONSTELLATION_PEOPLE.forEach((person, i) => {
        const p = positions.current[i];
        const open = isDelivered(person, y, l);
        const progress = Math.min(1, Math.max(0, (elapsed - i * 160) / 900));
        const gradient = c.createLinearGradient(cx, cy, p.x, p.y);
        gradient.addColorStop(0, open ? "rgba(139,220,79,.85)" : "rgba(122,162,255,.55)");
        gradient.addColorStop(1, open ? "rgba(21,179,212,.6)" : "rgba(122,162,255,.12)");
        c.strokeStyle = gradient;
        c.lineWidth = open ? 2 : 1.2;
        c.setLineDash(open ? [] : [4, 6]);
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + (p.x - cx) * progress, cy + (p.y - cy) * progress);
        c.stroke();
        c.setLineDash([]);

        // All'apertura: un impulso viaggia dal centro, poi un'onda si allarga intorno alla persona.
        const at = deliveredAt.current.get(i);
        if (open && at !== undefined && !reduced) {
          const d = now - at;
          if (d < PULSE_MS) {
            const f = d / PULSE_MS;
            c.fillStyle = "#d8ffb8";
            c.shadowColor = "#8bdc4f";
            c.shadowBlur = 20;
            c.beginPath();
            c.arc(cx + (p.x - cx) * f, cy + (p.y - cy) * f, 5, 0, Math.PI * 2);
            c.fill();
            c.shadowBlur = 0;
          } else if (d < PULSE_MS + WAVE_MS) {
            const f = (d - PULSE_MS) / WAVE_MS;
            c.strokeStyle = `rgba(139,220,79,${1 - f})`;
            c.lineWidth = 2;
            c.beginPath();
            c.arc(p.x, p.y, 10 + f * 46, 0, Math.PI * 2);
            c.stroke();
          }
        }
        // Capsula ancora in custodia: una piccola luce le gira intorno.
        if (!open && !reduced) {
          const a = now / 900 + i;
          c.fillStyle = "rgba(122,162,255,.8)";
          c.beginPath();
          c.arc(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 14, 1.8, 0, Math.PI * 2);
          c.fill();
        }

        const hovered = hover === i;
        c.fillStyle = open ? "#8bdc4f" : "#9fb6ff";
        c.shadowColor = open ? "#8bdc4f" : "#7aa2ff";
        c.shadowBlur = open || hovered ? 22 : 10;
        c.beginPath();
        c.arc(p.x, p.y, hovered ? 9 : 7, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.textAlign = "center";
        c.fillStyle = "#e9efff";
        c.font = `700 15px ${headFont}`;
        c.fillText(person.name, p.x, p.y + 26);
        c.fillStyle = open ? "#8bdc4f" : "#9aa8d8";
        c.font = `500 11px ${monoFont}`;
        c.fillText(open ? "✓ consegnata" : person.year !== undefined ? String(person.year) : "eredità", p.x, p.y + 41);
      });

      // Hinthia al centro, con un alone che respira.
      const breath = reduced ? 0 : Math.sin(now / 700) * 4;
      const glow = c.createRadialGradient(cx, cy, 4, cx, cy, 70 + breath);
      glow.addColorStop(0, "rgba(21,179,212,.55)");
      glow.addColorStop(1, "rgba(21,179,212,0)");
      c.fillStyle = glow;
      c.beginPath();
      c.arc(cx, cy, 70 + breath, 0, Math.PI * 2);
      c.fill();
      if (hinthia.complete && hinthia.naturalWidth > 0) c.drawImage(hinthia, cx - 34, cy - 36 + breath / 2, 68, 68);
      c.textAlign = "center";
      c.fillStyle = "#e9efff";
      c.font = `700 13px ${headFont}`;
      c.fillText("Tu", cx, cy + 50);
    }
    drawRef.current = draw;

    function loop(now: number) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    resize();
    hinthia.onload = () => draw(performance.now());
    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(sky);

    let visibility: IntersectionObserver | null = null;
    if (reduced) {
      draw(performance.now());
    } else {
      visibility = new IntersectionObserver(([entry]) => {
        cancelAnimationFrame(raf);
        if (entry.isIntersecting) raf = requestAnimationFrame(loop);
      });
      visibility.observe(sky);
    }
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      visibility?.disconnect();
    };
  }, [stars]);

  // Anno o eredità cambiati: si annota quando ogni capsula si è appena aperta, per l'impulso e l'onda.
  useEffect(() => {
    state.current.year = year;
    state.current.legacy = legacy;
    const now = performance.now();
    CONSTELLATION_PEOPLE.forEach((person, i) => {
      const open = isDelivered(person, year, legacy);
      if (open && !deliveredAt.current.has(i)) deliveredAt.current.set(i, now);
      if (!open) deliveredAt.current.delete(i);
    });
    if (reducedRef.current) drawRef.current(now);
  }, [year, legacy]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const current = state.current.year;
      if (current >= CONSTELLATION_LAST_YEAR) setPlaying(false);
      else setYear(current + 1);
    }, PLAY_STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing]);

  function togglePlay() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (year >= CONSTELLATION_LAST_YEAR) setYear(CONSTELLATION_FIRST_YEAR);
    setPlaying(true);
  }

  function hoverAt(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = -1;
    let bestDistance = 30;
    positions.current.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    state.current.hover = best;
    if (best < 0) {
      setTip(null);
    } else {
      const p = positions.current[best];
      setTip({ index: best, x: Math.min(Math.max(p.x, 110), rect.width - 110), y: p.y });
    }
    if (reducedRef.current) drawRef.current(performance.now());
  }

  const tipPerson = tip ? CONSTELLATION_PEOPLE[tip.index] : null;

  return (
    <section aria-labelledby="constellation-title" className="lp-night">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-4 pt-16 sm:px-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-4">
          <p className="lp-hand text-2xl text-[var(--lp-leaf)]">ogni persona è una stella</p>
          <h2 id="constellation-title" className="lp-title text-4xl leading-[1.05] sm:text-5xl">
            Ogni cosa arriva <span className="lp-gradient-text">al momento giusto.</span>
          </h2>
          <p className="lp-muted max-w-[42ch] text-lg">
            Prepari oggi, con calma. Ogni capsula parte alla sua data, oppure se un giorno non rispondi più. Fai scorrere gli
            anni e guarda.
          </p>
          <p className="lp-muted text-sm">Un esempio: persone e capsule sono inventate.</p>
        </div>
        <div
          ref={skyRef}
          className="lp-sky"
          onPointerMove={(e) => hoverAt(e.clientX, e.clientY)}
          onPointerDown={(e) => hoverAt(e.clientX, e.clientY)}
          onPointerLeave={() => {
            state.current.hover = -1;
            setTip(null);
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" />
          {tip && tipPerson ? (
            <div className="lp-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">
              <b className="lp-title block text-base">{tipPerson.name}</b>
              <span className="lp-muted block">{tipPerson.relation}</span>
              <span className="lp-muted block">{tipPerson.gift}</span>
              <span className="lp-mono mt-1 block text-xs text-[var(--lp-leaf)]">{deliveryStatus(tipPerson, year, legacy)}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 px-4 pt-2 pb-5 sm:px-10 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span key={year} className="lp-year tick min-w-[3.2ch] text-5xl sm:text-6xl" data-testid="constellation-year">
          {year}
        </span>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="constellation-year" className="lp-mono text-xs tracking-wider text-[#9aa8d8] uppercase">
            Fai scorrere gli anni
          </label>
          <input
            id="constellation-year"
            type="range"
            min={CONSTELLATION_FIRST_YEAR}
            max={CONSTELLATION_LAST_YEAR}
            value={year}
            onChange={(e) => {
              setPlaying(false);
              setYear(Number(e.target.value));
            }}
            className="w-full accent-[#15b3d4]"
          />
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 lg:col-span-1">
          <button type="button" className="lp-pill" onClick={togglePlay}>
            {playing ? "❚❚ Ferma" : "▶ Fai scorrere il tempo"}
          </button>
          <button type="button" className="lp-pill" aria-pressed={legacy} onClick={() => setLegacy((v) => !v)}>
            Se un giorno non rispondo più
          </button>
        </div>
      </div>

      <ul aria-label="Persone e capsule" className="lp-roster mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5 px-4 pb-16 sm:px-10">
        {CONSTELLATION_PEOPLE.map((person) => {
          const open = isDelivered(person, year, legacy);
          return (
            <li key={person.name} className={cn("flex flex-col gap-0.5 rounded-card px-3.5 py-2.5", open && "open")}>
              <b className="lp-title text-base font-bold">{person.name}</b>
              <span className="text-[13px] text-[#9aa8d8]">
                {person.relation} · {person.gift}
              </span>
              <span className="lp-status lp-mono text-xs text-[#9aa8d8]">{deliveryStatus(person, year, legacy)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
