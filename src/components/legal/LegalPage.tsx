import Link from "next/link";
import type { ReactNode } from "react";
import { isPlaceholder, LEGAL } from "@/content/legal";
import { BrandLockup } from "@/components/layout/BrandLockup";
import { BackLink } from "@/components/ui/BackLink";

/**
 * L'impaginazione comune di Privacy e Termini: pubbliche, leggibili senza accesso, testo a colonna stretta. Fuori da
 * (app), come la pagina dei fascicoli condivisi.
 */
export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center bg-background px-4 py-10 sm:px-6">
      <article className="flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href="/" className="w-fit">
            <BrandLockup className="h-auto w-40" darkSize="md" />
          </Link>
          {/* Il logo porta alla home, ma non si capisce: un "indietro" a parole, in cima, dove lo si cerca. */}
          <BackLink href="/">Torna alla pagina iniziale</BackLink>
        </div>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold text-balance text-zinc-900 dark:text-zinc-100">{title}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ultimo aggiornamento: {LEGAL.lastUpdated}</p>
          <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{intro}</div>
        </header>
        <div className="flex flex-col gap-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</div>
        <footer className="flex flex-wrap gap-4 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800">
          <Link href="/privacy" className="font-medium text-accent hover:underline">
            Informativa privacy
          </Link>
          <Link href="/termini" className="font-medium text-accent hover:underline">
            Termini d&apos;uso
          </Link>
          <Link href="/" className="font-medium text-accent hover:underline">
            Pagina iniziale
          </Link>
        </footer>
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

/** Un dato del titolare: se è ancora da compilare, si vede. */
export function LegalValue({ value }: { value: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  return <mark className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-950 dark:text-amber-200">{value}</mark>;
}
