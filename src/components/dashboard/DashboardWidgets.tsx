"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listDocuments } from "@/domain/documents/repository";
import { listReminders } from "@/domain/reminders/repository";
import type { DocumentListItem } from "@/domain/documents/types";
import type { ReminderListItem } from "@/domain/reminders/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The three dashboard widgets: upcoming reminders, recent documents, overdue items. */
export function DashboardWidgets({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [documentsResult, remindersResult] = await Promise.all([
        listDocuments(supabase, masterKey),
        listReminders(supabase, masterKey),
      ]);
      setDocuments(documentsResult);
      setReminders(remindersResult);
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

  if (loading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>;
  }

  if (documents.length === 0 && reminders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nessun contenuto ancora. Inizia da{" "}
          <Link href="/documents" className="font-medium text-brand hover:underline">
            Documenti
          </Link>{" "}
          per aggiungere il tuo primo documento.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
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
          Documenti recenti
        </h2>
        {recentDocuments.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Nessun documento ancora.
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
          href="/documents"
          className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
        >
          Vai ai documenti
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
  );
}
