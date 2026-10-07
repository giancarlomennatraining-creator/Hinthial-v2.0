"use client";

import Link from "next/link";
import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { AlertTriangleIcon, CheckCircleIcon, ReminderIcon } from "@/components/icons/nav-icons";
import { DashboardAreas } from "@/components/dashboard/DashboardAreas";
import { DashboardRecentDocuments } from "@/components/dashboard/DashboardRecentDocuments";
import { useToast } from "@/components/ui/ToastProvider";
import type { SummaryContext } from "@/domain/ai/types";
import type { ReminderListItem } from "@/domain/reminders/types";
import { setReminderCompleted, setReminderDueAt } from "@/domain/reminders/repository";
import {
  addDaysIso,
  buildTodayPlan,
  dayKey,
  daysUntil,
  deadlineLevel,
  whenText,
  type DeadlineLevel,
} from "@/domain/dashboard/deadlines";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<DeadlineLevel, { bar: string; chip: string; dot: string }> = {
  over: {
    bar: "bg-red-600",
    chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    dot: "bg-red-600",
  },
  danger: {
    bar: "bg-red-600",
    chip: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    dot: "bg-red-600",
  },
  warn: {
    bar: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  soft: {
    bar: "bg-brand",
    chip: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
    dot: "bg-brand",
  },
};

const CARD =
  "rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * La dashboard "Oggi": parte da cosa fare. Una frase dice quante cose chiedono attenzione e ogni scadenza vicina (o già
 * scaduta) ha il suo pulsante: segna fatta, rimanda di sette giorni. Il resto --- la settimana, i documenti recenti, le
 * aree --- sta di lato su schermo largo e sotto su smartphone. Gli stessi dati della Classica, un altro modo di
 * leggerli (v. useDashboardData).
 */
export function DashboardToday({
  supabase,
  masterKey,
  context,
  now,
  patchReminder,
}: {
  supabase: SupabaseClient<Database>;
  masterKey: CryptoKey;
  context: SummaryContext;
  now: Date;
  patchReminder: (id: string, patch: Partial<ReminderListItem>) => void;
}) {
  const showToast = useToast();
  const [handled, setHandled] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(() => dayKey(now));

  const plan = buildTodayPlan(context.reminders, now);
  const left = plan.actions.length;
  const total = left + handled;
  const progress = total === 0 ? 100 : Math.round((handled / total) * 100);
  const selected = plan.week.find((d) => d.key === selectedDay) ?? plan.week[0];

  async function handleDone(reminder: ReminderListItem) {
    setBusyId(reminder.id);
    patchReminder(reminder.id, { completed: true }); // ottimistico: la carta esce subito
    try {
      await setReminderCompleted(supabase, reminder.id, true);
      setHandled((n) => n + 1);
      showToast("Segnata come fatta.");
    } catch {
      patchReminder(reminder.id, { completed: false });
      showToast("Non è stato possibile segnarla come fatta — riprova.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSnooze(reminder: ReminderListItem) {
    setBusyId(reminder.id);
    const previous = reminder.dueAt;
    // Una scadenza già passata riparte da adesso, non dalla vecchia data: "rimanda di 7 giorni" è tra una settimana.
    const next = addDaysIso(daysUntil(previous, now) < 0 ? now.toISOString() : previous, 7);
    patchReminder(reminder.id, { dueAt: next });
    try {
      await setReminderDueAt(supabase, reminder.id, next);
      setHandled((n) => n + 1);
      showToast(`Rimandata a ${formatDay(next)}.`);
    } catch {
      patchReminder(reminder.id, { dueAt: previous });
      showToast("Non è stato possibile rimandarla — riprova.");
    } finally {
      setBusyId(null);
    }
  }

  const headline =
    left === 0 ? (
      "Tutto in ordine."
    ) : (
      <>
        Oggi <em className="not-italic text-teal-200">{left === 1 ? "1 cosa merita" : `${left} cose meritano`}</em>{" "}
        attenzione.
      </>
    );

  return (
    <div className="@container flex min-w-0 flex-col gap-6">
      <div className="grid min-w-0 gap-5 @3xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] @3xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-[#16307f] p-5 text-white">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-14 size-52 rounded-full bg-[radial-gradient(circle,rgba(63,209,184,0.4),transparent_65%)]"
            />
            <h2 className="relative text-2xl font-extrabold leading-tight tracking-tight">{headline}</h2>
            <p className="relative mt-1.5 text-sm text-white/80">
              {left === 0
                ? "Non c'è nient'altro da fare per oggi."
                : "Le altre scadenze sono più in là: le trovi nella settimana accanto."}
            </p>
            <div className="relative mt-4 flex items-center gap-2.5 text-xs text-white/85">
              <div
                role="progressbar"
                aria-label="Cose sistemate oggi"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 flex-1 overflow-hidden rounded-full bg-white/20"
              >
                <div
                  className="h-full rounded-full bg-teal-200 transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>
                {handled} di {total} sistemate
              </span>
            </div>
          </section>

          <h3 className="mt-1 px-0.5 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Da fare ora
          </h3>
          {left === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-zinc-300 p-7 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <CheckCircleIcon width={36} height={36} className="mx-auto mb-2 text-green-600 dark:text-green-400" />
              <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Hai finito per oggi</p>
              <p className="mt-0.5">Hinthial ti avvisa quando c&apos;è altro.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {plan.actions.map((reminder) => {
                const days = daysUntil(reminder.dueAt, now);
                const level = deadlineLevel(days);
                const style = LEVEL_STYLE[level];
                const Icon = level === "over" ? AlertTriangleIcon : ReminderIcon;
                return (
                  <li key={reminder.id} className={cn("grid min-w-0 grid-cols-[4px_1fr] overflow-hidden", CARD)}>
                    <span aria-hidden="true" className={style.bar} />
                    <div className="flex min-w-0 flex-col gap-2.5 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className={cn("grid size-9 shrink-0 place-items-center rounded-xl", style.chip)}
                        >
                          <Icon width={18} height={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                            {reminder.title}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className={cn("rounded-full px-2 py-0.5 font-semibold", style.chip)}>
                              {whenText(days)}
                            </span>{" "}
                            {formatDay(reminder.dueAt)}
                            {reminder.relatedAssetName ? ` · ${reminder.relatedAssetName}` : ""}
                          </p>
                          {reminder.relatedDocumentId && reminder.relatedDocumentFilename ? (
                            <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              Documento:{" "}
                              <Link
                                href={`/archive/${reminder.relatedDocumentId}`}
                                className="font-medium text-brand hover:underline"
                              >
                                {reminder.relatedDocumentFilename}
                              </Link>
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === reminder.id}
                          onClick={() => void handleDone(reminder)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                        >
                          <CheckCircleIcon width={14} height={14} />
                          Segna fatta
                        </button>
                        <button
                          type="button"
                          disabled={busyId === reminder.id}
                          onClick={() => void handleSnooze(reminder)}
                          className="rounded-xl border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        >
                          Rimanda di 7 giorni
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-1 px-0.5 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Più avanti
          </h3>
          <section className={cn("px-4 py-1.5", CARD)}>
            {plan.later.length === 0 ? (
              <p className="py-3 text-xs text-zinc-500 dark:text-zinc-400">Nient&apos;altro in arrivo.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {plan.later.map((reminder) => {
                  const days = daysUntil(reminder.dueAt, now);
                  return (
                    <li key={reminder.id} className="flex min-w-0 items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {reminder.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {formatDay(reminder.dueAt)}
                          {reminder.relatedAssetName ? ` · ${reminder.relatedAssetName}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          LEVEL_STYLE[deadlineLevel(days)].chip,
                        )}
                      >
                        {whenText(days)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/reminders" className="mb-1.5 inline-block text-xs font-medium text-brand hover:underline">
              Tutte le scadenze
            </Link>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className={cn("p-4", CARD)}>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Questa settimana</h3>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {plan.week.map((day) => {
                const worst = day.items.length
                  ? deadlineLevel(Math.min(...day.items.map((r) => daysUntil(r.dueAt, now))))
                  : null;
                return (
                  <button
                    key={day.key}
                    type="button"
                    aria-pressed={selectedDay === day.key}
                    aria-label={`${day.date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}${
                      day.items.length ? `: ${day.items.length} scadenze` : ""
                    }`}
                    onClick={() => setSelectedDay(day.key)}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-0.5 rounded-xl border px-0 py-2 text-[0.7rem] font-semibold transition-colors",
                      selectedDay === day.key
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
                    )}
                  >
                    {day.date.toLocaleDateString("it-IT", { weekday: "short" }).replace(".", "")}
                    <span
                      className={cn(
                        "text-base font-extrabold",
                        day.isToday ? "text-brand" : "text-zinc-900 dark:text-zinc-100",
                      )}
                    >
                      {day.date.getDate()}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn("size-1.5 rounded-full", worst ? LEVEL_STYLE[worst].dot : "bg-transparent")}
                    />
                  </button>
                );
              })}
            </div>
            <p className="mt-3 min-h-5 text-xs text-zinc-500 dark:text-zinc-400">
              <b className="text-zinc-900 dark:text-zinc-100">
                {selected.date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}:
              </b>{" "}
              {selected.items.length === 0
                ? "nessuna scadenza."
                : selected.items.map((r) => r.title).join(", ")}
            </p>
          </section>

          <DashboardRecentDocuments supabase={supabase} masterKey={masterKey} context={context} now={now} />

          <DashboardAreas context={context} />
        </div>
      </div>
    </div>
  );
}
