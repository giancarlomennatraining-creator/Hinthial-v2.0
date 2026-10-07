"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { useToast } from "@/components/ui/ToastProvider";
import type { SummaryContext } from "@/domain/ai/types";
import { BOARD_COLUMNS, buildBoard, columnOf, planMove, type BoardColumn } from "@/domain/dashboard/board";
import { daysUntil, deadlineLevel, whenText, type DeadlineLevel } from "@/domain/dashboard/deadlines";
import { setReminderCompleted, setReminderDueAt } from "@/domain/reminders/repository";
import type { ReminderListItem } from "@/domain/reminders/types";
import { cn } from "@/lib/utils";

const LEVEL_BAR: Record<DeadlineLevel | "done", string> = {
  over: "border-l-red-600",
  danger: "border-l-red-600",
  warn: "border-l-amber-500",
  soft: "border-l-brand",
  done: "border-l-green-600",
};

const LEVEL_PILL: Record<DeadlineLevel | "done", string> = {
  over: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  danger: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  soft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  done: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

const COLUMN_TITLE: Record<BoardColumn, string> = {
  over: "text-red-700 dark:text-red-400",
  week: "text-zinc-900 dark:text-zinc-100",
  month: "text-zinc-900 dark:text-zinc-100",
  later: "text-zinc-900 dark:text-zinc-100",
  done: "text-green-700 dark:text-green-400",
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

const labelOf = (column: BoardColumn) => BOARD_COLUMNS.find((c) => c.key === column)!.label;

/** Dove si può spostare a mano una carta: mai in "Da sistemare", che si riempie da sola. */
const MOVE_TARGETS: BoardColumn[] = ["week", "month", "later", "done"];

interface DragState {
  reminder: ReminderListItem;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
}

interface LastMove {
  id: string;
  text: string;
  previous: { completed: boolean; dueAt: string };
}

function CardBody({ reminder, now }: { reminder: ReminderListItem; now: Date }) {
  const days = daysUntil(reminder.dueAt, now);
  const level = reminder.completed ? "done" : deadlineLevel(days);
  return (
    <>
      <b className="text-[0.8rem] font-bold leading-snug text-zinc-900 dark:text-zinc-100">{reminder.title}</b>
      <small className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className={cn("rounded-full px-2 py-px text-[0.7rem] font-semibold", LEVEL_PILL[level])}>
          {reminder.completed ? "fatta" : whenText(days)}
        </span>
        {formatDay(reminder.dueAt)}
        {reminder.relatedAssetName ? ` · ${reminder.relatedAssetName}` : ""}
      </small>
    </>
  );
}

/**
 * La dashboard "Lavagna": le scadenze in colonne per tempo --- da sistemare, questa settimana, questo mese, più avanti,
 * fatte. Su schermo largo si trascina una carta (col mouse) in un'altra colonna e la sua data si sposta di conseguenza;
 * "Fatte" la segna completata. Ogni spostamento si può annullare per qualche secondo. Con la tastiera e su smartphone
 * (dove un trascinamento litigherebbe con lo scorrimento) ogni carta ha i pulsanti per spostarla; le colonne scorrono di
 * lato. In "Da sistemare" non si trascina: è ciò che è già scaduto.
 */
export function DashboardBoard({
  supabase,
  context,
  now,
  patchReminder,
}: {
  supabase: SupabaseClient<Database>;
  context: SummaryContext;
  now: Date;
  patchReminder: (id: string, patch: Partial<ReminderListItem>) => void;
}) {
  const showToast = useToast();
  const board = buildBoard(context.reminders, now);

  const [handled, setHandled] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverColumn, setHoverColumn] = useState<BoardColumn | null>(null);
  const [nope, setNope] = useState<BoardColumn | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const timers = useRef<number[]>([]);
  const cleanupDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      cleanupDrag.current?.();
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  async function applyMove(reminder: ReminderListItem, target: BoardColumn) {
    const plan = planMove(reminder, target, now);
    if (plan.kind === "none") return;
    if (plan.kind === "refused") {
      setNope(target);
      later(() => setNope(null), 500);
      showToast(plan.reason);
      return;
    }

    const previous = { completed: reminder.completed, dueAt: reminder.dueAt };
    patchReminder(reminder.id, { completed: plan.completed, ...(plan.dueAt ? { dueAt: plan.dueAt } : {}) }); // ottimistico
    try {
      if (plan.completed !== reminder.completed) await setReminderCompleted(supabase, reminder.id, plan.completed);
      if (plan.dueAt) await setReminderDueAt(supabase, reminder.id, plan.dueAt);
    } catch {
      patchReminder(reminder.id, previous);
      showToast("Non è stato possibile spostarla — riprova.");
      return;
    }

    if (target === "done") setHandled((n) => n + 1);
    setLanded(reminder.id);
    later(() => setLanded((id) => (id === reminder.id ? null : id)), 700);
    setLastMove({
      id: reminder.id,
      previous,
      text:
        target === "done"
          ? `«${reminder.title}» è fatta.`
          : `«${reminder.title}» spostata in "${labelOf(target)}"${plan.dueAt ? `: ${formatDay(plan.dueAt)}` : ""}.`,
    });
    later(() => setLastMove((m) => (m?.id === reminder.id ? null : m)), 9000);
  }

  async function undo() {
    if (!lastMove) return;
    const move = lastMove;
    const current = context.reminders.find((r) => r.id === move.id);
    setLastMove(null);
    if (!current) return;
    patchReminder(move.id, move.previous);
    try {
      if (current.completed !== move.previous.completed) await setReminderCompleted(supabase, move.id, move.previous.completed);
      if (current.dueAt !== move.previous.dueAt) await setReminderDueAt(supabase, move.id, move.previous.dueAt);
      if (move.previous.completed === false && current.completed) setHandled((n) => Math.max(0, n - 1));
      showToast("Spostamento annullato.");
    } catch {
      patchReminder(move.id, { completed: current.completed, dueAt: current.dueAt });
      showToast("Non è stato possibile annullare — riprova.");
    }
  }

  function columnAt(x: number, y: number): BoardColumn | null {
    const element = document.elementFromPoint(x, y);
    const column = element?.closest("[data-column]")?.getAttribute("data-column");
    return (column as BoardColumn | null) ?? null;
  }

  function onPointerDown(event: React.PointerEvent<HTMLLIElement>, reminder: ReminderListItem) {
    // Il trascinamento è del mouse: col dito litigherebbe con lo scorrimento (lì ci sono i pulsanti).
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if ((event.target as Element).closest("button")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    let started = false;

    function move(e: PointerEvent) {
      if (!started) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 5) return;
        started = true;
      }
      setDrag({ reminder, x: e.clientX, y: e.clientY, offsetX: startX - rect.left, offsetY: startY - rect.top, width: rect.width });
      setHoverColumn(columnAt(e.clientX, e.clientY));
    }
    function finish(e: PointerEvent | null) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
      cleanupDrag.current = null;
      setDrag(null);
      setHoverColumn(null);
      if (!started || !e) return;
      const target = columnAt(e.clientX, e.clientY);
      if (target) void applyMove(reminder, target);
    }
    function up(e: PointerEvent) {
      finish(e);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") finish(null);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("keydown", key);
    cleanupDrag.current = () => finish(null);
  }

  return (
    <div className="@container flex min-w-0 select-none flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Trascina una carta in un&apos;altra colonna (o usa i pulsanti): la scadenza si sposta di conseguenza.</span>
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 font-semibold text-brand">
          {handled} {handled === 1 ? "fatta" : "fatte"} oggi
        </span>
      </div>

      {lastMove ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
        >
          <span className="min-w-0 flex-1">{lastMove.text}</span>
          <button type="button" onClick={() => void undo()} className="font-bold text-brand hover:underline">
            Annulla
          </button>
        </div>
      ) : null}

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 @[800px]:grid @[800px]:snap-none @[800px]:grid-cols-5 @[800px]:overflow-visible">
        {BOARD_COLUMNS.map((column) => {
          const items = board[column.key];
          const isTarget = hoverColumn === column.key && drag !== null;
          const refusing = isTarget && column.key === "over";
          return (
            <section
              key={column.key}
              data-column={column.key}
              aria-label={column.label}
              className={cn(
                "flex min-h-40 min-w-[78%] snap-start flex-col gap-2 rounded-2xl border p-2.5 transition-colors @[800px]:min-w-0",
                refusing
                  ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                  : isTarget
                    ? "border-brand bg-brand/5"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40",
                nope === column.key && "board-nope",
              )}
            >
              <h3 className={cn("flex items-center justify-between gap-2 px-1 text-xs font-bold", COLUMN_TITLE[column.key])}>
                {column.label}
                <em className="rounded-full border border-zinc-200 bg-white px-2 py-px text-[0.7rem] font-semibold not-italic text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  {items.length}
                </em>
              </h3>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 px-2 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                  {column.key === "done" ? "Trascina qui ciò che hai fatto" : "Niente qui"}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {items.map((reminder) => {
                    const level = reminder.completed ? "done" : deadlineLevel(daysUntil(reminder.dueAt, now));
                    const dragging = drag?.reminder.id === reminder.id;
                    return (
                      <li
                        key={reminder.id}
                        onPointerDown={(event) => onPointerDown(event, reminder)}
                        className={cn(
                          "group flex min-w-0 cursor-grab flex-col gap-1.5 rounded-xl border border-l-4 border-zinc-200 bg-white p-2.5 shadow-[0_2px_6px_rgba(18,26,53,0.05)] dark:border-zinc-800 dark:bg-zinc-950",
                          LEVEL_BAR[level],
                          dragging && "opacity-40",
                          landed === reminder.id && "board-landed",
                        )}
                      >
                        <CardBody reminder={reminder} now={now} />
                        <div className="flex flex-wrap gap-1.5 @[800px]:sr-only @[800px]:focus-within:not-sr-only">
                          {MOVE_TARGETS.filter((target) => target !== columnOf(reminder, now)).map((target) => (
                            <button
                              key={target}
                              type="button"
                              aria-label={
                                target === "done"
                                  ? `Segna fatta «${reminder.title}»`
                                  : `Sposta «${reminder.title}» in ${labelOf(target)}`
                              }
                              onClick={() => void applyMove(reminder, target)}
                              className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-brand hover:bg-brand/10 dark:border-zinc-700 dark:bg-zinc-950"
                            >
                              {target === "done" ? "✓ Fatta" : `→ ${labelOf(target).replace(/^Questa |^Questo /, "").toLowerCase()}`}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {drag
        ? createPortal(
            <div
              aria-hidden="true"
              className="pointer-events-none fixed z-50 flex flex-col gap-1.5 rounded-xl border border-l-4 border-zinc-200 bg-white p-2.5 shadow-[0_18px_30px_rgba(18,26,53,0.28)] dark:border-zinc-700 dark:bg-zinc-950"
              style={{
                width: drag.width,
                left: drag.x - drag.offsetX,
                top: drag.y - drag.offsetY,
                transform: "rotate(2.5deg)",
                borderLeftColor: "var(--brand)",
              }}
            >
              <CardBody reminder={drag.reminder} now={now} />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
