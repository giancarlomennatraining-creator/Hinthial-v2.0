"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { dueIn } from "@/domain/documents/archive-views";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { deleteReminder, listReminders, setReminderCompleted } from "@/domain/reminders/repository";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { ArchiveTabs } from "@/components/documents/ArchiveTabs";
import { PageHelp } from "@/components/help/PageHelp";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { buildIcsCalendar } from "@/lib/ics";
import { saveBlobAsFile } from "@/lib/download";
import { sanitizeFilename } from "@/lib/utils";
import type { ReminderListItem } from "@/domain/reminders/types";
import { useToast } from "@/components/ui/ToastProvider";
import { BTN_PRIMARY, INPUT_FIELD } from "@/components/ui/styles";
import { EmptyListCard } from "@/components/ui/EmptyListCard";
import { DocumentExpiryList } from "@/components/reminders/DocumentExpiryList";
import { listDocumentExpiries, type DocumentExpiry } from "@/domain/documents/repository";

type StatusFilter = "all" | "pending" | "completed";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Il colore del "fra 19 giorni": rosso se passata, arancio se urgente, ambra da tenere d'occhio, grigio se lontana. */
const DUE_COLOR = {
  overdue: "font-medium text-red-600 dark:text-red-400",
  danger: "font-medium text-orange-600 dark:text-orange-400",
  warn: "text-amber-700 dark:text-amber-400",
  soft: "",
  none: "",
} as const;

function dueStatus(dueAt: string, completed: boolean): "overdue" | "soon" | "ok" {
  if (completed) return "ok";
  const daysLeft = (new Date(dueAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "soon";
  return "ok";
}

export function RemindersPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [reminders, setReminders] = useState<ReminderListItem[]>([]);
  // Le date di scadenza scritte nella scheda dei documenti: si vedono qui accanto alle scadenze create come tali.
  const [documentExpiries, setDocumentExpiries] = useState<DocumentExpiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // "?created=1" arriva da /reminders/new dopo un salvataggio riuscito ---
  // v. CapsulesPanel.tsx per il motivo dello stato pigro qui sotto.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) showToast("Scadenza creata.");
    if (showCreatedMessage) router.replace("/reminders");
  }, [showCreatedMessage, router, showToast]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [remindersResult, expiriesResult] = await Promise.all([
        listReminders(supabase, masterKey),
        listDocumentExpiries(supabase, masterKey),
      ]);
      setReminders(remindersResult);
      setDocumentExpiries(expiriesResult);
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

  function handleExportOne(reminder: ReminderListItem) {
    const ics = buildIcsCalendar([{ id: reminder.id, title: reminder.title, dueAt: reminder.dueAt }]);
    saveBlobAsFile(
      new Blob([ics], { type: "text/calendar" }),
      `${sanitizeFilename(reminder.title)}.ics`,
    );
  }

  const filteredReminders = reminders.filter((r) => {
    if (statusFilter === "pending") return !r.completed;
    if (statusFilter === "completed") return r.completed;
    return true;
  });

  function handleExportAll() {
    const ics = buildIcsCalendar(
      filteredReminders.map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt })),
    );
    saveBlobAsFile(new Blob([ics], { type: "text/calendar" }), "hinthial-scadenze.ics");
  }


  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="flex min-w-0 w-full items-start justify-between gap-3 sm:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-title">
            Archivio
          </h1>
          <PageHelp
            title="Scadenze"
            tips={[
              { icon: "➕", text: "Crea una scadenza e collegala, se vuoi, a un bene o a un documento." },
              { icon: "✅", text: "Segnala una scadenza come completata quando l'hai gestita." },
              { icon: "🔗", text: "Le scadenze collegate a un bene compaiono anche nella sua scheda." },
              { icon: "📄", text: "Qui trovi anche i documenti con una data di scadenza: la data si cambia dalla loro scheda." },
            ]}
          />
        </div>
        <Link
          href="/reminders/new"
          className={`hidden shrink-0 ${BTN_PRIMARY} sm:block`}
        >
          + Crea scadenza
        </Link>
      </div>

      <ArchiveTabs />

      <MobileAddFab href="/reminders/new" label="Aggiungi scadenza" />

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : reminders.length === 0 && documentExpiries.length === 0 ? (
        <EmptyListCard text="Nessuna scadenza ancora." actionHref="/reminders/new" actionLabel="Crea la prima scadenza" />
      ) : (
        <>
          {reminders.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna scadenza creata da te.{" "}
              <Link href="/reminders/new" className="font-medium text-accent hover:underline">
                Crea la prima scadenza →
              </Link>
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  aria-label="Filtra per stato"
                  className={INPUT_FIELD}
                >
                  <option value="all">Tutte</option>
                  <option value="pending">Da completare</option>
                  <option value="completed">Completate</option>
                </select>
                <button
                  type="button"
                  onClick={handleExportAll}
                  disabled={filteredReminders.length === 0}
                  title="Scarica un file .ics da importare nel calendario del telefono o del computer."
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  📅 Esporta calendario (.ics)
                </button>
              </div>

              {filteredReminders.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Nessuna scadenza corrisponde ai filtri.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-zinc-200 surface-card rounded-card border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                  {filteredReminders.map((reminder) => {
                    const status = dueStatus(reminder.dueAt, reminder.completed);
                    const due = dueIn(reminder.dueAt, new Date());
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
                                  ? "truncate text-sm text-zinc-500 line-through dark:text-zinc-500"
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
                              {reminder.completed ? null : (
                                <span className={DUE_COLOR[due.level]}> · {due.text}</span>
                              )}
                              {reminder.relatedDocumentFilename ? ` · ${reminder.relatedDocumentFilename}` : ""}
                              {reminder.relatedAssetName ? ` · 🔗 ${reminder.relatedAssetName}` : ""}
                            </p>
                          </span>
                        </label>
                        <RowActionsMenu label={`Azioni per "${reminder.title}"`}>
                          <RowMenuItem onClick={() => handleExportOne(reminder)}>
                            📅 Aggiungi al calendario (.ics)
                          </RowMenuItem>
                          <RowMenuItem disabled={busy} danger onClick={() => handleDelete(reminder)}>
                            Elimina
                          </RowMenuItem>
                        </RowActionsMenu>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {documentExpiries.length > 0 ? <DocumentExpiryList items={documentExpiries} now={new Date()} /> : null}
        </>
      )}
    </div>
  );
}
