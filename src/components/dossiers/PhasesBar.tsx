"use client";

import { useState } from "react";
import { PHASE_PRESETS, MAX_PHASES, MAX_PHASE_NAME_LENGTH, parsePhaseNames, phaseState, type DossierPhases } from "@/domain/dossiers/phases";
import { SMALL_BUTTON, TEXT_INPUT } from "@/components/dossiers/styles";

/**
 * Le tappe della vicenda e quella in cui si è. Si sposta con un clic: la scelta è dell'utente, Hinthial non decide a che
 * punto sei. Facoltativa: senza fasi il fascicolo non mostra nulla di tutto questo.
 */
export function PhasesBar({
  phases,
  disabled,
  onSelect,
  onEdit,
}: {
  phases: DossierPhases;
  disabled: boolean;
  onSelect: (index: number) => void;
  onEdit: () => void;
}) {
  return (
    <section
      aria-label="Fasi"
      className="flex flex-col gap-3 rounded-[18px] border border-[#dfe3f0] bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100">
          Fase: {phases.names[phases.current]}
        </h2>
        <span className="flex items-center gap-3 text-xs text-[#5b6483] dark:text-zinc-400">
          Clicca una fase per spostarti: la scelta è tua.
          <button type="button" onClick={onEdit} className="font-bold text-brand hover:underline">
            Modifica le fasi
          </button>
        </span>
      </div>
      <ol className="flex flex-wrap gap-2" aria-label="Elenco delle fasi">
        {phases.names.map((name, index) => {
          const state = phaseState(phases, index);
          return (
            <li key={`${index}-${name}`}>
              <button
                type="button"
                disabled={disabled}
                aria-current={state === "current" ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors disabled:opacity-60 ${
                  state === "current"
                    ? "border-brand bg-brand text-white"
                    : state === "done"
                      ? "border-[#bfe3d2] bg-[#e3f4ec] text-[#1c7c5a] hover:border-[#1c7c5a]"
                      : "border-[#dfe3f0] bg-white text-[#5b6483] hover:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    state === "current" ? "bg-white/25" : state === "done" ? "bg-[#1c7c5a] text-white" : "bg-[#eef0f8] dark:bg-zinc-900"
                  }`}
                  aria-hidden="true"
                >
                  {state === "done" ? "✓" : index + 1}
                </span>
                {name}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Sceglie un modello o scrive le fasi a mano ("Visite, Esami, Cura"); si possono cambiare in ogni momento. */
export function PhasesEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: DossierPhases | null;
  busy: boolean;
  onSave: (names: string[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial ? initial.names.join(", ") : "");
  const names = parsePhaseNames(text);

  return (
    <section
      aria-label="Modifica le fasi"
      className="flex flex-col gap-3 rounded-[18px] border border-[#dfe3f0] bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="font-heading text-base font-extrabold text-[#121a35] dark:text-zinc-100">Le fasi di questo fascicolo</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#5b6483] dark:text-zinc-400">Parti da un modello:</span>
        {PHASE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setText(preset.names.join(", "))}
            className="rounded-full border border-[#dfe3f0] bg-white px-3 py-1 text-xs font-bold text-[#3d4670] hover:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && names.length > 0) onSave(names);
        }}
        placeholder="Trattativa, Proposta, Mutuo, Rogito"
        aria-label="Nomi delle fasi"
        className={TEXT_INPUT}
      />
      <p className="text-xs text-[#5b6483] dark:text-zinc-400">
        Separale con una virgola, in ordine. Al massimo {MAX_PHASES} fasi di {MAX_PHASE_NAME_LENGTH} lettere.
        {names.length > 0 ? ` Ne hai scritte ${names.length}.` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || names.length === 0}
          onClick={() => onSave(names)}
          className="rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          Salva le fasi
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={SMALL_BUTTON}>
          Annulla
        </button>
        {initial ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave([])}
            className="rounded-[10px] px-3 py-2 text-[13px] font-bold text-red-600 hover:underline disabled:opacity-50"
          >
            Togli le fasi
          </button>
        ) : null}
      </div>
    </section>
  );
}
