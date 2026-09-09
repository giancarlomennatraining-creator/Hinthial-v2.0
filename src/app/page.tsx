import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LandingCarousel } from "@/components/landing/LandingCarousel";
import { ArrowRightIcon, SecurityIcon } from "@/components/icons/nav-icons";

const STRENGTHS: { icon: string; title: string; description: string }[] = [
  {
    icon: "🔐",
    title: "Zero-knowledge davvero",
    description:
      "Cifratura basata solo su Web Crypto API, nativa del browser --- nessun algoritmo scritto a mano. La tua master password non lascia mai il tuo dispositivo, nemmeno verso i nostri server.",
  },
  {
    icon: "🗂️",
    title: "Tutto in un posto solo",
    description:
      "Documenti, foto, audio, video, note, asset, scadenze e contatti fiduciari --- organizzati, con categorie e tag, e sempre ritrovabili con una ricerca.",
  },
  {
    icon: "🤖",
    title: "Un assistente che non ti spia",
    description:
      "Fai domande sui tuoi contenuti e ricevi risposte con le fonti citate --- tutto elaborato sul tuo dispositivo, nulla lascia mai il browser.",
  },
  {
    icon: "📦",
    title: "Capsule per chi conta",
    description:
      "Prepara messaggi e contenuti cifrati da lasciare alle persone giuste, quando conta davvero --- affidati a uno o più contatti fiduciari.",
  },
  {
    icon: "🌓",
    title: "A modo tuo",
    description:
      "Tema chiaro, scuro o come il tuo dispositivo; vista a elenco o a tabella per ogni sezione --- le tue preferenze restano impostate ovunque tu acceda.",
  },
  {
    icon: "🧭",
    title: "Costruito un passo alla volta",
    description:
      "Ogni funzionalità nasce prima semplice e verificata, poi si estende --- funzionante, sicuro, semplice: in quest'ordine, mai il contrario.",
  },
];

const STEPS: { number: string; title: string; description: string }[] = [
  {
    number: "1",
    title: "Crea il tuo account",
    description: "Registrati e imposta la tua master password --- la chiave di tutto, che solo tu conosci.",
  },
  {
    number: "2",
    title: "Aggiungi ciò che conta",
    description: "Documenti, asset, contatti fiduciari, capsule --- tutto cifrato prima ancora di lasciare il tuo dispositivo.",
  },
  {
    number: "3",
    title: "Decidi chi vede cosa, e quando",
    description: "Prepara capsule per le persone giuste, da aprire quando conta davvero.",
  },
];

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto sm:h-10" />
        </Link>

        {user ? (
          <Link
            href="/dashboard"
            className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
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
            <Link
              href="/register"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Registrati
            </Link>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center gap-20 px-6 pb-16">
        {/* Hero --- relative/overflow-hidden solo per contenere la "bolla"
            decorativa (background, non un <img> posizionato: non
            partecipa mai al layout, quindi non può alterare
            larghezza/altezza della pagina né aggiungere barre di
            scorrimento). Un <div>, non un secondo <main>: un solo
            landmark "main" per pagina. */}
        <div className="relative w-full overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(31,175,149,0.16) 0%, rgba(31,175,149,0) 70%)",
            }}
          />

          <div className="relative flex flex-col items-center gap-20 pt-16">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <SecurityIcon width={15} height={15} className="shrink-0" />
                Zero-knowledge davvero: nemmeno noi vediamo i tuoi dati
              </div>

              <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
                La tua vita digitale, in ordine e <span className="text-brand">al sicuro</span>.
              </h1>
              <p className="max-w-xl text-base text-zinc-600 dark:text-zinc-400">
                Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le informazioni
                importanti accessibili alle persone giuste quando serve --- il tutto cifrato in modo
                che solo tu possa leggerlo.
              </p>

              {/* Se l'utente è già autenticato, la call to action per la dashboard
                  vive già nella barra in alto --- non ripetuta qui. */}
              {user ? null : (
                <div className="flex flex-col items-center gap-4">
                  <Link
                    href="/register"
                    className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(43,79,196,0.28)] hover:bg-brand-hover"
                  >
                    Crea account
                    <ArrowRightIcon width={16} height={16} />
                  </Link>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Hai già un account?{" "}
                    <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      Accedi
                    </Link>
                  </p>
                </div>
              )}
            </div>

            <LandingCarousel />
          </div>
        </div>

        {/* Punti di forza --- stile brochure: una griglia responsive di
            proposte di valore, più ampie del singolo "cosa fai" del
            carosello sopra. */}
        <section className="flex w-full max-w-5xl flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Perché Hinthial
            </h2>
            <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Non solo un altro posto dove salvare le cose --- un modo diverso di pensare alla
              propria vita digitale.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STRENGTHS.map((strength) => (
              <div
                key={strength.title}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span aria-hidden="true" className="text-3xl">
                  {strength.icon}
                </span>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {strength.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{strength.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Come funziona --- tre passi, per dare subito il senso del percorso. */}
        <section className="flex w-full max-w-4xl flex-col items-center gap-10">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Come funziona
          </h2>

          <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col items-center gap-3 text-center">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-base font-semibold text-white"
                >
                  {step.number}
                </span>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA finale --- utile su una pagina lunga, per non dover risalire. */}
        {user ? null : (
          <section className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              Pronto a mettere ordine?
            </h2>
            <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Crea il tuo account gratuito --- bastano un minuto e una master password che solo tu
              conoscerai.
            </p>
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(43,79,196,0.28)] hover:bg-brand-hover"
            >
              Inizia subito
              <ArrowRightIcon width={16} height={16} />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
