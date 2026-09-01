"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import { deleteReminder, listReminders, setReminderCompleted } from "@/domain/reminders/repository";
import type { ReminderListItem } from "@/domain/reminders/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dueStatus(dueAt: string, completed: boolean): "overdue" | "soon" | "ok" {
  if (completed) return "ok";
  const daysLeft = (new Date(dueAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "soon";
  return "ok";
}

export function RemindersPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // "?created=1" arriva da /reminders/new dopo un salvataggio riuscito ---
  // v. CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) router.replace("/reminders");
  }, [showCreatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setReminders(await listReminders(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le scadenze.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleToggleCompleted(reminder: ReminderListItem) {
    setBusyId(reminder.id);
    setError(null);
    try {
      await setReminderCompleted(supabase, reminder.id, !reminder.completed);
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, completed: !r.completed } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la scadenza.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(reminder: ReminderListItem) {
    if (!window.confirm(`Eliminare la scadenza "${reminder.title}"?`)) return;

    setBusyId(reminder.id);
    setError(null);
    try {
      await deleteReminder(supabase, reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la scadenza.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Scadenze
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Promemoria per le date importanti, cifrati come tutto il resto.
          </p>
        </div>
        <Link
          href="/reminders/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Crea scadenza
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Scadenza creata.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : reminders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna scadenza ancora. Aggiungine una col tasto qui sopra.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {reminders.map((reminder) => {
            const status = dueStatus(reminder.dueAt, reminder.completed);
            const busy = busyId === reminder.id;
            return (
              <li key={reminder.id} className="flex items-center justify-between gap-4 p-4">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={reminder.completed}
                    disabled={busy}
                    onChange={() => handleToggleCompleted(reminder)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <p
                      className={
                        reminder.completed
                          ? "truncate text-sm text-zinc-400 line-through dark:text-zinc-600"
                          : "truncate text-sm font-medium text-zinc-900 dark:text-zinc-100"
                      }
                    >
                      {reminder.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      <span
                        className={
                          status === "overdue"
                            ? "font-medium text-red-600 dark:text-red-400"
                            : status === "soon"
                              ? "font-medium text-orange-600 dark:text-orange-400"
                              : ""
                        }
                      >
                        {formatDate(reminder.dueAt)}
                      </span>
                      {reminder.relatedDocumentFilename ? ` · ${reminder.relatedDocumentFilename}` : ""}
                      {reminder.relatedAssetName ? ` · 🔗 ${reminder.relatedAssetName}` : ""}
                    </p>
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDelete(reminder)}
                  className="shrink-0 text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                >
                  Elimina
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
