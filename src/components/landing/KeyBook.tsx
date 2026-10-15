"use client";

import { useEffect, useRef, useState } from "react";
import { BOOK_PAGES, hexLine, pseudoCipher, randomGlyph } from "@/components/landing/landing-content";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import { cn } from "@/lib/utils";

const HOLD_MS = 1000;
const SCRAMBLE_MS = 1100;
const STREAM_LINES = Array.from({ length: 14 }, (_, i) => hexLine(i));

/**
 * Mostra `target` lettera per lettera, partendo da glifi a caso: l'effetto "si decifra". Con il movimento ridotto il testo
 * arriva subito. Il testo che legge uno screen reader è sempre quello finale (v. chi la usa).
 */
function useScrambled(target: string): string {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      const frame = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(frame);
    }
    const startedAt = performance.now();
    const revealAt = Array.from({ length: target.length }, (_, i) => (i / target.length) * SCRAMBLE_MS * 0.65 + Math.random() * SCRAMBLE_MS * 0.35);
    let frame = requestAnimationFrame(function step(now) {
      const elapsed = now - startedAt;
      let text = "";
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        text += elapsed >= revealAt[i] || ch === " " ? ch : randomGlyph();
      }
      setShown(text);
      if (elapsed < SCRAMBLE_MS) frame = requestAnimationFrame(step);
      else setShown(target);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}

/**
 * "Il libro e la chiave": il libro si apre solo tenendo premuto (come lo sblocco con l'impronta), le pagine si decifrano davanti
 * agli occhi e "Come lo vediamo noi" mostra ciò che arriva davvero ai server: testo illeggibile. Il testo cifrato è finto
 * (`pseudoCipher`): serve solo a far vedere l'idea.
 */
export function KeyBook() {
  const [open, setOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [serverView, setServerView] = useState(false);
  const [progress, setProgress] = useState(0);
  const [turns, setTurns] = useState<number[]>([]);
  const holding = useRef(false);
  const progressRef = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);

  const page = BOOK_PAGES[pageIndex];
  // Chiuso, il libro è cifrato: si decifra quando si apre.
  const readable = open && !serverView;
  const show = (text: string) => (readable ? text : pseudoCipher(text));
  const title = useScrambled(show(page.title));
  const body = useScrambled(show(page.body));

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function setP(value: number) {
    progressRef.current = value;
    setProgress(value);
  }

  function tick(now: number) {
    const dt = now - last.current;
    last.current = now;
    const next = Math.max(0, Math.min(1, progressRef.current + (holding.current ? dt / HOLD_MS : -dt / 400)));
    setP(next);
    if (next >= 1) {
      holding.current = false;
      setOpen(true);
      setP(0);
      return;
    }
    if (holding.current || next > 0) raf.current = requestAnimationFrame(tick);
  }

  function begin() {
    if (open) return;
    if (prefersReducedMotion()) {
      setOpen(true);
      return;
    }
    holding.current = true;
    last.current = performance.now();
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }

  function release() {
    holding.current = false;
  }

  function nextPage() {
    setPageIndex((i) => (i + 1) % BOOK_PAGES.length);
    if (!prefersReducedMotion()) {
      const id = Date.now();
      setTurns((t) => [...t, id]);
      window.setTimeout(() => setTurns((t) => t.filter((x) => x !== id)), 820);
    }
  }

  return (
    <section aria-labelledby="book-title" className="lp-night lp-book-section">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-10 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.25fr)]">
        <div className="flex flex-col gap-4">
          <p className="lp-hand text-2xl text-[var(--lp-leaf)]">si apre solo con la tua chiave</p>
          <h2 id="book-title" className="lp-title text-4xl leading-[1.05] sm:text-5xl">
            Il libro della tua vita, scritto per chi ami.
          </h2>
          <p className="lp-muted max-w-[44ch] text-lg">
            Racconti, lettere, istruzioni: Hinthial li cifra sul tuo dispositivo prima di salvarli, con una chiave che conosci
            solo tu. Sui nostri server arriva testo illeggibile, e tale resta. Nemmeno noi possiamo aprirlo.
          </p>
          <div role="group" aria-label="Punto di vista" className="lp-seg flex w-fit flex-wrap gap-1 rounded-full border border-[#2b4699] p-1">
            <button
              type="button"
              aria-pressed={!serverView}
              onClick={() => setServerView(false)}
              className="lp-title rounded-full px-3.5 pt-1.5 pb-1 text-[15px] font-bold text-[#a9bbe8]"
            >
              Come lo vedi tu
            </button>
            <button
              type="button"
              aria-pressed={serverView}
              onClick={() => setServerView(true)}
              className="lp-title rounded-full px-3.5 pt-1.5 pb-1 text-[15px] font-bold text-[#a9bbe8]"
            >
              Come lo vediamo noi
            </button>
          </div>
          <span className="lp-mono text-xs tracking-wider text-[#a9bbe8] uppercase">Ciò che arriva al server</span>
          <div className="lp-stream" aria-hidden="true">
            <div>
              {[...STREAM_LINES, ...STREAM_LINES].map((line, i) => (
                <p key={i} className="lp-mono px-3 text-xs leading-relaxed whitespace-nowrap text-[#6f8fe0]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center gap-5">
          <div className={cn("lp-book", open ? "open" : "closed", serverView && "cipher")} data-testid="key-book">
            <div className="lp-spread">
              <div className="lp-page left">
                <span className="lp-mono text-[11px] tracking-widest text-[#1b5fe3] uppercase">Indice</span>
                <p className="lp-title text-lg leading-tight sm:text-2xl">Il mio libro</p>
                <ul className="mt-1 flex flex-col gap-1.5 text-xs sm:text-[15px]">
                  {[
                    ["Racconti", "12"],
                    ["Capsule", "3"],
                    ["Documenti", "48"],
                    ["Istruzioni", "5"],
                    ["Guardiani", "2"],
                  ].map(([label, count]) => (
                    <li key={label} className="flex justify-between gap-2 border-b border-dashed border-[#c8d4ee] pb-1">
                      <span>{label}</span>
                      <span className="lp-mono text-[#5a6b9c]">{count}</span>
                    </li>
                  ))}
                </ul>
                <span className="lp-mono mt-auto text-[10px] text-[#5a6b9c] sm:text-[11px]">AES-GCM · chiave solo sul dispositivo</span>
              </div>
              <div className="lp-page right">
                <span className="lp-page-tag lp-mono text-[10px] tracking-widest uppercase sm:text-[11px]">{readable ? page.tag : "cifrato"}</span>
                <p className="sr-only">{readable ? `${page.title}. ${page.body}` : "Contenuto cifrato, illeggibile senza la chiave."}</p>
                <p aria-hidden="true" className="lp-page-title lp-title text-sm leading-tight sm:text-2xl">
                  {title}
                </p>
                <p aria-hidden="true" className="lp-page-body">
                  {body}
                </p>
                <span className="lp-mono mt-auto text-[10px] text-[#5a6b9c] sm:text-[11px]">{readable ? page.meta : `iv: ${pseudoCipher(page.meta).slice(0, 16)}`}</span>
              </div>
              {turns.map((id) => (
                <div key={id} className="lp-sheet" aria-hidden="true" />
              ))}
              <div className="lp-cover" aria-hidden="true">
                <svg viewBox="0 0 100 110">
                  <path d="M50 4l40 15v29c0 26-17 47-40 58C27 95 10 74 10 48V19z" fill="url(#lp-g-shield)" />
                  <defs>
                    <linearGradient id="lp-g-shield" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#15b3d4" />
                      <stop offset=".5" stopColor="#47c25b" />
                      <stop offset="1" stopColor="#8bdc4f" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="48" r="11" fill="#fff" />
                  <path d="M45 54h10l4 26H41z" fill="#fff" />
                </svg>
                <span className="lp-title text-2xl text-white sm:text-3xl">Hinthial</span>
                <span className="lp-hand text-lg text-[#bfe9ff] sm:text-xl">il mio libro</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {open ? (
              <>
                <button type="button" onClick={nextPage} className="lp-pill">
                  Pagina dopo →
                </button>
                <button type="button" onClick={() => setOpen(false)} className="text-[15px] text-[#a9bbe8] underline underline-offset-4">
                  Chiudi il libro
                </button>
              </>
            ) : (
              <button
                type="button"
                className="lp-hold lp-title flex items-center gap-3 rounded-full border border-[#2b4699] bg-white/5 py-1.5 pr-5 pl-1.5 text-base font-bold"
                onPointerDown={begin}
                onPointerUp={release}
                onPointerLeave={release}
                onPointerCancel={release}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  // Da tastiera non si "tiene premuto": Invio o spazio aprono subito.
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(true);
                  }
                }}
              >
                <svg viewBox="0 0 50 50" aria-hidden="true" className="h-11 w-11 -rotate-90">
                  <circle cx="25" cy="25" r="21" fill="none" stroke="#2b4699" strokeWidth="4" />
                  <circle className="lp-hold-progress" cx="25" cy="25" r="21" pathLength={1} strokeDashoffset={1 - progress} />
                </svg>
                Tieni premuto per aprire
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
