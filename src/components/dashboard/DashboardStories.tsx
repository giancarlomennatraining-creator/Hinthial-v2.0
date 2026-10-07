"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { ComponentType, SVGProps } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ArchiveIcon,
  ArrowRightIcon,
  CapsuleIcon,
  DashboardIcon,
  ReminderIcon,
  SecurityIcon,
} from "@/components/icons/nav-icons";
import { DashboardAreas } from "@/components/dashboard/DashboardAreas";
import { DashboardRecentDocuments } from "@/components/dashboard/DashboardRecentDocuments";
import type { SummaryContext } from "@/domain/ai/types";
import { whenText } from "@/domain/dashboard/deadlines";
import { buildStories } from "@/domain/dashboard/stories";
import { categoryColor, UNCATEGORIZED_COLOR } from "@/domain/documents/archive-views";
import { cn } from "@/lib/utils";

interface SlideDef {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  color: string;
  background: string;
}

const SLIDES: SlideDef[] = [
  { key: "today", label: "Oggi", Icon: DashboardIcon, color: "#2b4fc4", background: "linear-gradient(165deg,#3a5fd6,#16307f)" },
  { key: "deadlines", label: "Scadenze", Icon: ReminderIcon, color: "#c2560c", background: "linear-gradient(165deg,#e07418,#9a3412)" },
  { key: "archive", label: "Archivio", Icon: ArchiveIcon, color: "#6d4fc4", background: "linear-gradient(165deg,#7c5ae0,#34257d)" },
  { key: "capsules", label: "Capsule", Icon: CapsuleIcon, color: "#0f8b8d", background: "linear-gradient(165deg,#12a5aa,#0b3f5e)" },
  { key: "steps", label: "Primi passi", Icon: SecurityIcon, color: "#16307f", background: "linear-gradient(165deg,#1c3d9c,#080e26)" },
];

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Un numero che sale da zero: chi preferisce meno movimento lo vede subito intero. */
function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1100);
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return (
    <>
      <span aria-hidden="true">{value}</span>
      <span className="sr-only">{to}</span>
    </>
  );
}

function StoryRing({ pct, children, color = "#fff" }: { pct: number; children: ReactNode; color?: string }) {
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[150px] self-center" style={{ marginBlock: 6 }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="rgba(255,255,255,0.22)" />
        <circle
          className="story-ring-bar"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
          style={{ "--full": c } as CSSProperties}
        />
      </svg>
      <b className="absolute inset-0 flex items-center justify-center text-[34px] font-extrabold tracking-tight">{children}</b>
    </div>
  );
}

const CTA =
  "relative z-[6] inline-flex items-center gap-2 self-start rounded-[14px] bg-white px-[18px] py-[11px] text-sm font-extrabold text-[#16307f] hover:brightness-95";

const KICK = "text-xs font-bold uppercase tracking-[0.1em] opacity-80";
const TITLE = "text-[clamp(1.5rem,6.4cqw,1.95rem)] font-extrabold leading-[1.08] tracking-tight";
const TEXT = "text-[0.9rem] leading-snug opacity-90";
const BIG = "text-[clamp(4rem,24cqw,6.75rem)] font-extrabold leading-[0.9] tracking-[-0.05em]";

function rise(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

function attentionText(overdue: number, thisWeek: number): string {
  const late = overdue === 1 ? "una è già scaduta" : `${overdue} sono già scadute`;
  const soon = thisWeek === 1 ? "una arriva questa settimana" : `${thisWeek} arrivano questa settimana`;
  const text = overdue > 0 && thisWeek > 0 ? `${late} e ${soon}` : overdue > 0 ? late : thisWeek > 0 ? soon : "";
  if (!text) return "Non c'è nient'altro da fare per oggi.";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * La dashboard "Storie": la tua giornata a cinque schermate che scorrono da sole, come le storie. Tocca a destra per
 * avanzare e a sinistra per tornare indietro, tieni premuto per fermarle, o usa il pulsante di pausa e le frecce. Su
 * schermo largo la storia sta al centro con l'indice a sinistra e i documenti recenti e le aree a destra. Chi
 * preferisce meno movimento non le vede avanzare da sole.
 */
export function DashboardStories({
  supabase,
  masterKey,
  context,
  now,
}: {
  supabase: SupabaseClient<Database>;
  masterKey: CryptoKey;
  context: SummaryContext;
  now: Date;
}) {
  const data = buildStories(context, now);
  const [slide, setSlide] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const paused = userPaused || holding;

  const def = SLIDES[slide];
  const next = () => setSlide((s) => (s + 1) % SLIDES.length);
  const previous = () => setSlide((s) => Math.max(0, s - 1));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!(event.target as Element).closest("[data-nopause]")) setHolding(true);
  }

  const colorOf = (categoryId: string | null) => {
    const category = context.categories.find((c) => c.id === categoryId);
    return category ? categoryColor(category.name) : UNCATEGORIZED_COLOR;
  };

  function body(): ReactNode {
    if (def.key === "today") {
      const { count, overdue, thisWeek } = data.attention;
      return (
        <>
          <div aria-hidden="true" className="story-deco pointer-events-none absolute -right-[70px] top-[60px] z-[1] size-[260px] rounded-full border-2 border-white/20 shadow-[0_0_0_30px_rgba(255,255,255,0.05),0_0_0_64px_rgba(255,255,255,0.04)]" />
          <p className={KICK} style={rise(0)}>
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <div className="flex-1" />
          <div className={BIG} style={rise(1)}>
            <CountUp to={count} />
          </div>
          <h3 className={TITLE} style={rise(2)}>
            {count === 0 ? "Tutto in ordine oggi" : count === 1 ? "cosa chiede attenzione oggi" : "cose chiedono attenzione oggi"}
          </h3>
          <p className={TEXT} style={rise(3)}>
            {attentionText(overdue, thisWeek)}
          </p>
          <button type="button" data-nopause className={CTA} style={rise(4)} onClick={() => setSlide(1)}>
            Vedi le scadenze <ArrowRightIcon width={16} height={16} />
          </button>
        </>
      );
    }

    if (def.key === "deadlines") {
      return (
        <>
          <p className={KICK} style={rise(0)}>
            Scadenze
          </p>
          <h3 className={TITLE} style={rise(1)}>
            {data.upcoming.length === 0 ? "Nessuna scadenza in arrivo" : "Le prossime"}
          </h3>
          {data.upcoming.map((item, n) => {
            const date = new Date(item.dueAt);
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur-sm" style={rise(n + 2)}>
                <div className="flex size-[42px] flex-none flex-col items-center justify-center rounded-[13px] bg-white/95 text-base font-extrabold leading-none text-[#16307f]">
                  <small className="text-[9px] font-bold uppercase">
                    {date.toLocaleDateString("it-IT", { month: "short" }).replace(".", "")}
                  </small>
                  {date.getDate()}
                </div>
                <div className="min-w-0">
                  <b className="block truncate text-sm">{item.title}</b>
                  <small className="text-xs opacity-80">
                    {whenText(item.days)}
                    {item.assetName ? ` · ${item.assetName}` : ""}
                  </small>
                </div>
              </div>
            );
          })}
          <div className="flex-1" />
          <Link href="/reminders" data-nopause className={CTA} style={rise(5)}>
            Tutte le scadenze <ArrowRightIcon width={16} height={16} />
          </Link>
        </>
      );
    }

    if (def.key === "archive") {
      const { newThisWeek, total, recent } = data.archive;
      return (
        <>
          <p className={KICK} style={rise(0)}>
            Archivio
          </p>
          <div className={BIG} style={rise(1)}>
            <CountUp to={newThisWeek} />
          </div>
          <h3 className={TITLE} style={rise(2)}>
            {newThisWeek === 1 ? "documento nuovo questa settimana" : "documenti nuovi questa settimana"}
          </h3>
          <div className="flex-1" />
          <div aria-hidden="true" className="relative h-[120px]" style={rise(3)}>
            {recent.map((doc, k) => (
              <i
                key={doc.id}
                className="story-page absolute bottom-0 left-1/2 -ml-[38px] block h-[98px] w-[76px] overflow-hidden rounded-[10px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
                style={{ "--k": k } as CSSProperties}
              >
                <span className="block h-[18px]" style={{ background: colorOf(doc.categoryId) }} />
                <span className="mx-3 mt-3.5 block h-[3px] rounded-sm bg-[#d6dbee] shadow-[0_10px_0_#d6dbee,0_20px_0_#d6dbee,0_30px_0_#e6e9f5]" />
              </i>
            ))}
          </div>
          <p className={TEXT} style={rise(4)}>
            {total === 0 ? "Ancora nulla in archivio." : `In tutto hai ${total} ${total === 1 ? "documento" : "documenti"} in archivio.`}
          </p>
          <Link href="/archive" data-nopause className={CTA} style={rise(5)}>
            {total === 0 ? "Aggiungi il primo contenuto" : "Apri l'archivio"} <ArrowRightIcon width={16} height={16} />
          </Link>
        </>
      );
    }

    if (def.key === "capsules") {
      const capsule = data.capsule;
      return (
        <>
          <p className={KICK} style={rise(0)}>
            Capsule
          </p>
          <h3 className={TITLE} style={rise(1)}>
            {capsule
              ? `Il ${new Date(capsule.openAt).toLocaleDateString("it-IT", { day: "numeric", month: "long" })} si apre «${capsule.title}»`
              : "Nessuna capsula in programma"}
          </h3>
          <div className="flex-1" />
          {capsule ? (
            <div style={rise(2)} className="self-center">
              <StoryRing pct={1 - Math.min(capsule.days, 90) / 90}>
                <CountUp to={capsule.days} />
              </StoryRing>
            </div>
          ) : null}
          <p className={cn(TEXT, "text-center")} style={rise(3)}>
            {capsule ? (
              <>
                {capsule.days === 1 ? "giorno" : "giorni"} all&apos;apertura
                {capsule.recipient ? ` per ${capsule.recipient}` : ""}.
                {capsule.others > 0 ? (
                  <>
                    <br />
                    {capsule.others === 1 ? "Un'altra capsula è programmata." : `Altre ${capsule.others} capsule sono programmate.`}
                  </>
                ) : null}
              </>
            ) : (
              "Una capsula è un messaggio o un contenuto da lasciare a chi vuoi tu."
            )}
          </p>
          <div className="flex-1" />
          <Link href="/capsules" data-nopause className={CTA} style={rise(4)}>
            {capsule ? "Vedi le capsule" : "Crea una capsula"} <ArrowRightIcon width={16} height={16} />
          </Link>
        </>
      );
    }

    const { done, total, missing } = data.steps;
    return (
      <>
        <p className={KICK} style={rise(0)}>
          Primi passi
        </p>
        <h3 className={TITLE} style={rise(1)}>
          {missing ? `Manca un passo: ${missing.label.charAt(0).toLowerCase()}${missing.label.slice(1)}` : "Tutto pronto. La tua cassaforte è completa."}
        </h3>
        <div className="flex-1" />
        <div style={rise(2)} className="self-center">
          <StoryRing pct={done / total} color="#7af0d8">
            <CountUp to={Math.round((done / total) * 100)} />%
          </StoryRing>
        </div>
        <p className={cn(TEXT, "text-center")} style={rise(3)}>
          {done} {done === 1 ? "passo" : "passi"} su {total} completati
        </p>
        <div className="flex-1" />
        {missing ? (
          <Link href={missing.href} data-nopause className={CTA} style={rise(4)}>
            Vai al passo <ArrowRightIcon width={16} height={16} />
          </Link>
        ) : null}
      </>
    );
  }

  return (
    <div className="@container min-w-0">
      <div className="grid min-w-0 justify-items-center gap-4 @[860px]:grid-cols-[210px_minmax(0,390px)_minmax(0,1fr)] @[860px]:items-start @[860px]:justify-items-stretch @[860px]:gap-6">
        <nav aria-label="Storie" className="hidden flex-col gap-1.5 @[860px]:flex">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-current={i === slide}
              onClick={() => setSlide(i)}
              className={cn(
                "flex items-center gap-2.5 rounded-[14px] border-[1.5px] px-3 py-2 text-left text-sm font-semibold transition hover:translate-x-[3px]",
                i === slide
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200",
              )}
            >
              <i className="grid size-[26px] place-items-center rounded-[9px] not-italic text-white" style={{ background: s.color }}>
                <s.Icon width={14} height={14} />
              </i>
              {s.label}
            </button>
          ))}
        </nav>

        <div
          role="group"
          aria-roledescription="storie"
          aria-label={`Storia ${slide + 1} di ${SLIDES.length}: ${def.label}`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onPointerCancel={() => setHolding(false)}
          className={cn(
            "relative aspect-[9/14.5] max-h-[660px] w-full max-w-[392px] touch-pan-y select-none overflow-hidden rounded-[28px] text-white shadow-[0_10px_30px_rgba(18,26,53,0.2)]",
            paused && "story-paused",
          )}
          style={{ background: def.background }}
        >
          <div className="absolute inset-x-3.5 top-3 z-[6] flex gap-1">
            {SLIDES.map((s, i) => (
              <div key={s.key} className="h-[3.5px] flex-1 overflow-hidden rounded-full bg-white/30">
                <i
                  className={cn("block h-full bg-white", i < slide ? "w-full" : i === slide ? "story-seg-on w-0" : "w-0")}
                  onAnimationEnd={i === slide ? next : undefined}
                />
              </div>
            ))}
          </div>

          <div className="absolute left-4 right-3 top-6 z-[6] flex items-center gap-2 text-[13px] font-bold">
            <span className="grid size-[30px] place-items-center rounded-full bg-white/20">
              <def.Icon width={15} height={15} />
            </span>
            {def.label}
            <button
              type="button"
              data-nopause
              aria-label={userPaused ? "Riprendi" : "Pausa"}
              aria-pressed={userPaused}
              onClick={() => setUserPaused((p) => !p)}
              className="ml-auto grid size-8 place-items-center rounded-full bg-white/20 text-white"
            >
              {userPaused ? (
                <ArrowRightIcon width={15} height={15} />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 5v14M15 5v14" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="button"
            aria-label="Storia precedente"
            onClick={previous}
            className="absolute bottom-[74px] left-0 top-16 z-[4] w-[32%]"
          />
          <button
            type="button"
            aria-label="Storia successiva"
            onClick={next}
            className="absolute bottom-[74px] right-0 top-16 z-[4] w-[68%]"
          />

          <div key={slide} className="story-rise absolute inset-0 z-[3] flex flex-col gap-3.5 px-[22px] pb-[22px] pt-[74px]">
            {body()}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-4">
          <DashboardRecentDocuments supabase={supabase} masterKey={masterKey} context={context} now={now} />
          <DashboardAreas context={context} />
        </div>
      </div>
    </div>
  );
}
