import type { ReactNode } from "react";

/**
 * La pagina a tutto schermo per quando qualcosa non va (v. app/not-found.tsx e app/error.tsx): il logo, un titolo, due
 * righe che dicono cosa è successo e che i dati sono al sicuro, e la strada per tornare. Niente barra laterale: può
 * comparire anche a chi non ha fatto l'accesso.
 */
export function StatusScreen({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand asset (SVG), not user content */}
        <img src="/brand/logo-lockup.svg" alt="HINTHIAL" className="h-auto w-40" />
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold tracking-wider text-brand uppercase">{eyebrow}</p>
          <h1 className="font-heading text-3xl font-extrabold text-balance text-zinc-900 dark:text-zinc-100">{title}</h1>
          <div className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </div>
    </main>
  );
}
