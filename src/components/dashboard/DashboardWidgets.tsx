"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { buildAIContext } from "@/domain/ai/context";
import { mockAIProvider } from "@/domain/ai/mock-provider";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { computeOnboardingSteps, isOnboardingComplete } from "@/domain/onboarding/steps";
import { DashboardCounters } from "@/components/dashboard/DashboardCounters";
import { WatchlistWidget } from "@/components/dashboard/WatchlistWidget";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import type { AIContext, AISuggestion } from "@/domain/ai/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Il corpo della dashboard, a due colonne (la prima più larga): a
 * sinistra i contatori per sezione, prossime scadenze, aggiunti di
 * recente ed elementi da completare; a destra la guida "Onboarding"
 * (finché non completata) e "Da tenere d'occhio" (v. WatchlistWidget).
 * Tutto derivato da un unico AIContext (v. domain/ai/context.ts) --- lo
 * stesso snapshot già decifrato che usano Assistente AI e ricerca
 * globale, costruito una sola volta qui invece che con una query per
 * widget.
 */
export function DashboardWidgets({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [context, setContext] = useState<AIContext | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const built = await buildAIContext(supabase, masterKey);
      setContext(built);
      setSuggestions(mockAIProvider.suggest(built));
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
  const assets = context?.assets ?? [];
  const contacts = context?.contacts ?? [];
  const capsules = context?.capsules ?? [];

  const upcoming = reminders
    .filter((r) => !r.completed && new Date(r.dueAt).getTime() >= now)
    .slice(0, 5);
  const overdue = reminders
    .filter((r) => !r.completed && new Date(r.dueAt).getTime() < now)
    .slice(0, 5);
  const recentDocuments = documents.slice(0, 5);

  // "Prima esperienza" della spec (v. domain/onboarding/steps.ts, condivisa
  // con l'indicatore persistente nel menu laterale --- v.
  // components/layout/OnboardingStatus): account e cifratura sono per
  // definizione già fatti se questo componente sta renderizzando (è
  // gated da MasterKey "unlocked", v. DashboardPanel).
  const onboardingSteps = computeOnboardingSteps({ documents, assets, contacts, capsules });
  const onboardingComplete = isOnboardingComplete(onboardingSteps);

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
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      {/* Colonna larga: un colpo d'occhio su quanto c'è, cosa scade, cosa
          è arrivato di recente, cosa va completato. */}
      <div className="flex flex-col gap-6">
        <DashboardCounters context={context} />

        <div className="grid gap-6 sm:grid-cols-3">
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Prossime scadenze
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Nessuna in arrivo.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {upcoming.map((r) => (
                  <li key={r.id} className="text-xs">
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

          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
                  <li key={doc.id} className="text-xs">
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

          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Elementi da completare
            </h2>
            {overdue.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Tutto in regola.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {overdue.map((r) => (
                  <li key={r.id} className="text-xs">
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

      {/* Colonna stretta: guida (primi passi) e cose a cui prestare attenzione. */}
      <div className="flex flex-col gap-6">
        {onboardingComplete ? null : <OnboardingChecklist steps={onboardingSteps} />}
        <WatchlistWidget context={context} suggestions={suggestions} />
      </div>
    </div>
  );
}
