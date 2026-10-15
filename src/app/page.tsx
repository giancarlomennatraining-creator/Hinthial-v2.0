import type { CSSProperties } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Constellation } from "@/components/landing/Constellation";
import { KeyBook } from "@/components/landing/KeyBook";
import { SeedStory } from "@/components/landing/SeedStory";
import { HERO_HIGHLIGHT, HERO_TITLE } from "@/components/landing/landing-content";
import { SecurityIcon } from "@/components/icons/nav-icons";
import { BTN_PRIMARY } from "@/components/ui/styles";
import "@/components/landing/landing.css";

/** Scintille che girano intorno a Hinthia: durata, ritardo e raggio dell'orbita. */
const SPARKS = [
  { t: "7s", d: "0s", r: "150px" },
  { t: "9s", d: "-3s", r: "130px" },
  { t: "11s", d: "-6s", r: "165px" },
  { t: "8s", d: "-2s", r: "120px" },
];

/**
 * La pagina pubblica. Racconta la tesi in tre movimenti: il seme che diventa albero e consegna le sue foglie (i quattro
 * pilastri), la costellazione delle persone (il momento giusto) e il libro che si apre solo con la tua chiave (zero-knowledge).
 */
export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="lp flex min-h-screen flex-col font-sans">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--lp-line)] px-6 py-4">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto sm:h-10" />
        </Link>

        {user ? (
          <Link href="/dashboard" className={`shrink-0 ${BTN_PRIMARY}`}>
            Vai alla dashboard
          </Link>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Accedi
            </Link>
            <Link href="/register" className={BTN_PRIMARY}>
              Registrati
            </Link>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-10 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:py-20">
          <div className="flex flex-col gap-4">
            <p className="lp-hand text-2xl text-[var(--lp-green)] sm:text-3xl">per chi verrà dopo, e per chi c&apos;è adesso</p>
            <h1 className="lp-title text-[2.4rem] leading-[1.02] sm:text-6xl">
              {HERO_TITLE.split(" ").map((word, i) => (
                <span key={i}>
                  <span className={`lp-word${HERO_HIGHLIGHT.has(word) ? " lp-gradient-text" : ""}`} style={{ "--i": i } as CSSProperties}>
                    {word}
                  </span>{" "}
                </span>
              ))}
            </h1>
            <p className="lp-muted max-w-[46ch] text-lg">
              Hinthial custodisce ricordi, documenti e istruzioni, cifrati sul tuo dispositivo, e li fa arrivare a chi scegli tu,
              quando scegli tu.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {user ? null : (
                <Link href="/register" className="lp-btn">
                  Crea il tuo spazio
                </Link>
              )}
              <a href="#come-cresce" className="lp-btn-ghost">
                Guarda come funziona
              </a>
            </div>
            {user ? null : (
              <p className="lp-muted text-sm">
                Hai già un account?{" "}
                <Link href="/login" className="font-medium text-[var(--lp-fg)] hover:underline">
                  Accedi
                </Link>
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-[var(--lp-muted)]">
              <SecurityIcon width={16} height={16} className="shrink-0 text-[var(--lp-green)]" />
              Cifrato sul tuo dispositivo: nemmeno noi possiamo leggerlo.
            </p>
          </div>
          <div className="lp-orb justify-self-center" aria-hidden="true">
            <picture>
              <source srcSet="/brand/hinthia/hinthia-512.webp" type="image/webp" />
              <img src="/brand/hinthia/hinthia-512.png" alt="" width={512} height={512} />
            </picture>
            {SPARKS.map((s) => (
              <span key={s.d} className="lp-spark" style={{ "--t": s.t, "--d": s.d, "--r": s.r } as CSSProperties} />
            ))}
          </div>
        </section>

        <SeedStory />
        <Constellation />
        <KeyBook />

        {user ? null : (
          <section className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-16 sm:px-10">
            <h2 className="lp-title max-w-[20ch] text-3xl leading-tight sm:text-4xl">Il primo seme è già nella tua testa.</h2>
            <Link href="/register" className="lp-btn">
              Inizia adesso
            </Link>
          </section>
        )}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-10 text-sm text-[var(--lp-muted)] sm:px-10">
        <span>Hinthial</span>
        <Link href="/privacy" className="hover:text-[var(--lp-fg)] hover:underline">
          Informativa privacy
        </Link>
        <Link href="/termini" className="hover:text-[var(--lp-fg)] hover:underline">
          Termini d&apos;uso
        </Link>
      </footer>
    </div>
  );
}
