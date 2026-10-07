"use client";

import { useState } from "react";
import { expiryInfo, formatDayMonthYear } from "@/domain/documents/archive-views";
import { MAX_STEP_LENGTH, sortSteps, type DossierStep } from "@/domain/dossiers/items";
import { CARD, CARD_TITLE, SMALL_BUTTON, TEXT_INPUT } from "@/components/dossiers/styles";

const LEVEL_COLOR = { overdue: "#b42318", danger: "#b42318", warn: "#8a5a00", soft: "#5b6483", none: "#5b6483" } as const;

/** I prossimi passi di una vicenda: poche righe, con un giorno se serve. Quelli con un giorno contano tra le scadenze del fascicolo. */
export function DossierNextSteps({
  steps,
  now,
  busy,
  onAdd,
  onToggle,
  onDelete,
}: {
  steps: DossierStep[];
  now: Date;
  busy: boolean;
  onAdd: (text: string, dueOn: string | null) => void;
  onToggle: (step: DossierStep, done: boolean) => void;
  onDelete: (step: DossierStep) => void;
}) {
  const [text, setText] = useState("");
  const [dueOn, setDueOn] = useState("");
  const sorted = sortSteps(steps);
  const left = steps.filter((s) => !s.done).length;

  function submit() {
    if (!text.trim()) return;
    onAdd(text, dueOn || null);
    setText("");
    setDueOn("");
  }

  return (
    <section aria-label="Prossimi passi" className={CARD}>
      <div className="flex items-baseline justify-between">
        <h2 className={CARD_TITLE}>Prossimi passi</h2>
        {steps.length > 0 ? <span className="text-xs font-bold text-[#5b6483] dark:text-zinc-400">{left} da fare</span> : null}
      </div>
      <ul className="flex flex-col">
        {sorted.map((step) => {
          const info = step.dueOn && !step.done ? expiryInfo(step.dueOn, now) : null;
          return (
            <li key={step.id} className="flex items-start gap-2.5 border-t border-[#eef0f8] py-2 first:border-t-0 first:pt-0 dark:border-zinc-900">
              <input
                type="checkbox"
                checked={step.done}
                disabled={busy}
                onChange={(e) => onToggle(step, e.target.checked)}
                aria-label={`${step.text}: fatto`}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#1c7c5a]"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-sm leading-snug font-semibold break-words ${step.done ? "text-[#5b6483] line-through dark:text-zinc-500" : ""}`}>
                  {step.text}
                </span>
                {step.dueOn ? (
                  <span className="text-xs font-bold" style={{ color: info ? LEVEL_COLOR[info.level] : "#8a91ad" }}>
                    {formatDayMonthYear(step.dueOn)}
                    {info ? ` · ${info.text.replace("scade ", "")}` : ""}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDelete(step)}
                aria-label={`Togli ${step.text}`}
                className="shrink-0 rounded-md px-1.5 text-base leading-none text-[#8a91ad] hover:text-red-600 disabled:opacity-50"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={text}
          maxLength={MAX_STEP_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Fissare il rogito…"
          aria-label="Aggiungi un passo"
          className={TEXT_INPUT}
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            aria-label="Giorno del passo (facoltativo)"
            className={`${TEXT_INPUT} flex-1`}
          />
          <button type="button" disabled={busy || !text.trim()} onClick={submit} className={SMALL_BUTTON}>
            Aggiungi
          </button>
        </div>
      </div>
    </section>
  );
}
