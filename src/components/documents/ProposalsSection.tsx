"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { sortAlphabetically } from "@/lib/utils";
import type { Category } from "@/domain/categories/types";
import type { Proposal, ProposalKind } from "@/domain/proposals/types";

/**
 * FASE 19 --- le proposte di Hinthial su un contenuto, con le tre
 * risposte possibili.
 *
 * "Modifica" non è un ornamento tra accetta e rifiuta: è il caso più
 * frequente. Una proposta è spesso giusta per metà --- la data c'è ma è
 * quella sbagliata, la categoria è vicina ma non quella --- e senza una
 * terza via l'utente dovrebbe rifiutare e poi rifare tutto a mano
 * altrove, che è il modo più sicuro per fargli smettere di leggere le
 * proposte.
 *
 * L'annullamento vive qui e non in un popup: una riga che resta finché
 * l'utente non fa altro. Un avviso che sparisce da solo dopo tre secondi
 * non è un annullamento, è una cortesia.
 */

const KIND_LABEL: Record<ProposalKind, string> = {
  expiry: "Scadenza",
  category: "Categoria",
};

const KIND_ICON: Record<ProposalKind, string> = {
  expiry: "⏳",
  category: "🏷️",
};

export interface UndoableAction {
  message: string;
  onUndo: () => void;
}

export function ProposalsSection({
  proposals,
  categories,
  busy,
  undoable,
  onAccept,
  onReject,
}: {
  proposals: Proposal[];
  categories: Category[];
  busy: boolean;
  undoable: UndoableAction | null;
  /** `value` può differire da `proposal.value`: è il percorso di "Modifica". */
  onAccept: (proposal: Proposal, value: string) => void;
  onReject: (proposal: Proposal) => void;
}) {
  const [editing, setEditing] = useState<ProposalKind | null>(null);
  const [draft, setDraft] = useState("");

  if (proposals.length === 0 && !undoable) return null;

  function startEditing(proposal: Proposal) {
    setEditing(proposal.kind);
    setDraft(proposal.value);
  }

  function displayValue(proposal: Proposal): string {
    if (proposal.kind === "expiry") return formatDate(proposal.value);
    return categories.find((c) => c.id === proposal.value)?.name ?? proposal.value;
  }

  return (
    <section
      aria-label="Proposte"
      className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Hinthial propone
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">🔒 sul tuo dispositivo</p>
      </div>

      {undoable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="min-w-0 text-sm text-zinc-700 dark:text-zinc-300">{undoable.message}</p>
          <button
            type="button"
            disabled={busy}
            onClick={undoable.onUndo}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </button>
        </div>
      ) : null}

      {proposals.map((proposal) => {
        const isEditing = editing === proposal.kind;

        return (
          <div
            key={`${proposal.kind}-${proposal.value}`}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">
                {KIND_ICON[proposal.kind]}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {KIND_LABEL[proposal.kind]}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {displayValue(proposal)}
                  </span>
                  {proposal.derived ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      calcolata da Hinthial
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 italic dark:text-zinc-400">
                  {proposal.source}
                </p>
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                {proposal.kind === "expiry" ? (
                  <input
                    type="date"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Scadenza da impostare"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                ) : (
                  <select
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Categoria da impostare"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  >
                    {sortAlphabetically(categories, (c) => c.name).map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={busy || !draft}
                  onClick={() => {
                    setEditing(null);
                    onAccept(proposal, draft);
                  }}
                  className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  Salva
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Annulla
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAccept(proposal, proposal.value)}
                  className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  Accetta
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startEditing(proposal)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Modifica
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onReject(proposal)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  No, grazie
                </button>
              </div>
            )}
          </div>
        );
      })}

      {proposals.length > 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Quello che rifiuti non te lo richiedo più. Ogni scelta resta in Attività.
        </p>
      ) : null}
    </section>
  );
}
