"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  createReminder,
  deleteReminder,
  listReminders,
  setReminderCompleted,
} from "@/domain/reminders/repository";
import { listDocuments } from "@/domain/documents/repository";
import type { ReminderListItem } from "@/domain/reminders/types";
import type { DocumentListItem } from "@/domain/documents/types";

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

  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [remindersResult, documentsResult] = await Promise.all([
        listReminders(supabase, masterKey),
        listDocuments(supabase, masterKey),
      ]);
      setReminders(remindersResult);
      setDocuments(documentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le scadenze.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentiPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Captured now: React nulls out event.currentTarget once the
    // synchronous dispatch finishes, which has already happened by the
    // time an `await` below resumes.
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const dueAt = String(formData.get("dueAt") ?? "");
    const relatedDocumentId = String(formData.get("relatedDocumentId") ?? "") || null;

    if (!title || !dueAt) {
      setError("Inserisci almeno un titolo e una data.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createReminder(supabase, masterKey, user.id, {
        title,
        dueAt: new Date(dueAt).toISOString(),
        relatedDocumentId,
      });
      form.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la scadenza.");
    } finally {
      setCreating(false);
    }
  }

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Scadenze
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Promemoria per le date importanti, cifrati come tutto il resto.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Titolo
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="es. Rinnovo assicurazione auto"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="dueAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Data
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="date"
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="relatedDocumentId"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Documento collegato
          </label>
          <select
            id="relatedDocumentId"
            name="relatedDocumentId"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="">Nessuno</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {creating ? "Creazione…" : "Aggiungi scadenza"}
        </button>
      </form>

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
            Nessuna scadenza ancora. Aggiungine una qui sopra.
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
