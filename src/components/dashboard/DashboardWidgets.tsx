"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { DashboardCounters } from "@/components/dashboard/DashboardCounters";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { AIContext } from "@/domain/ai/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Il corpo della dashboard: contatori per sezione, prossime scadenze,
 * aggiunti di recente ed elementi da completare. Niente checklist
 * "Onboarding" qui (v. richiesta utente) --- resta comunque
 * consultabile dal gadget persistente nella barra laterale (v.
 * OnboardingStatus).
 *
 * Niente più "Da tenere d'occhio" (v. richiesta utente): due delle sue
 * tre righe ripetevano dati già mostrati nelle card qui sopra
 * (scadenze scadute = "Elementi da completare", scadenze entro 7
 * giorni = "Prossime scadenze"), e il resto erano metriche di
 * completezza ("N di M amici non collegati a nessuna capsula") che
 * misurano l'ordine, non un rischio --- una sezione costruita su
 * regole che contano sempre qualcosa ha sempre qualcosa da dire, e
 * così smette di significare qualcosa. I suggerimenti proattivi
 * restano dove sono chiesti esplicitamente, in Assistente AI (v.
 * SuggestionsList).
 *
 * Tutto derivato da un unico AIContext (v. domain/ai/context.ts) ---
 * lo stesso snapshot già decifrato che usano Assistente AI e ricerca
 * globale, costruito una sola volta qui invece che con una query per
 * widget.
 */
export function DashboardWidgets({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [context, setContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const built = await buildAIContext(supabase, masterKey);
      setContext(built);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare la dashboard.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Read once at mount (lazy initializer), rather than calling the
  // impure Date.now() directly during render.
  const [now] = useState(() => Date.now());

  const documents = context?.documents ?? [];
  const reminders = context?.reminders ?? [];

  const upcoming = reminders
    .filter((r) => !r.completed && new Date(r.dueAt).getTime() >= now)
    .slice(0, 5);
  const overdue = reminders
    .filter((r) => !r.completed && new Date(r.dueAt).getTime() < now)
    .slice(0, 5);
  const recentDocuments = documents.slice(0, 5);

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (loading || !context) {
    return <DashboardSkeleton />;
  }

  return (
    // min-w-0 --- altrimenti un elemento a larghezza intrinseca (es. un
    // nome file lungo senza spazi) può forzare la colonna, e con essa la
    // pagina, oltre la larghezza dello schermo su mobile.
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardCounters context={context} />

      <div className="grid min-w-0 gap-6 sm:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Prossime scadenze
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Nessuna in arrivo.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {upcoming.map((r) => (
                <li key={r.id} className="min-w-0 text-xs">
                  <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">{r.title}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{formatDate(r.dueAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/reminders"
            className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
          >
            Vai alle scadenze
          </Link>
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Aggiunti di recente
          </h2>
          {recentDocuments.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Ancora nulla in archivio.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {recentDocuments.map((doc) => (
                <li key={doc.id} className="min-w-0 text-xs">
                  <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {doc.filename}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400">{formatDate(doc.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/archive"
            className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
          >
            Vai all&apos;archivio
          </Link>
        </section>

        <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Elementi da completare
          </h2>
          {overdue.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Tutto in regola.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {overdue.map((r) => (
                <li key={r.id} className="min-w-0 text-xs">
                  <p className="truncate font-medium text-red-700 dark:text-red-400">{r.title}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">scaduta il {formatDate(r.dueAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/reminders"
            className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
          >
            Vai alle scadenze
          </Link>
        </section>
      </div>

    </div>
  );
}
