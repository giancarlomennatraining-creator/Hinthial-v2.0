import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LandingCarousel } from "@/components/landing/LandingCarousel";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
          <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-8 w-auto sm:h-10" />
        </Link>

        {user ? (
          <Link
            href="/dashboard"
            className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
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
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Registrati
            </Link>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center gap-16 px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
            La tua vita digitale, in ordine e al sicuro
          </h1>
          <p className="max-w-xl text-base text-zinc-600 dark:text-zinc-400">
            Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le informazioni
            importanti accessibili alle persone giuste quando serve --- il tutto cifrato in modo
            che solo tu possa leggerlo.
          </p>

          {/* Se l'utente è già autenticato, la call to action per la dashboard
              vive già nella barra in alto --- non ripetuta qui. */}
          {user ? null : (
            <Link
              href="/register"
              className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Crea account
            </Link>
          )}
        </div>

        <LandingCarousel />
      </main>
    </div>
  );
}
