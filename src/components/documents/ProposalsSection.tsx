"use client";

import { useState } from "react";
import { formatDate } from "@/lib/format";
import { sortAlphabetically } from "@/lib/utils";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import { inferFieldInputType } from "@/domain/structured-fields/value-type";
import type { Proposal, ProposalKind } from "@/domain/proposals/types";

/**
 * Le proposte di Hinthial su un contenuto, con tre risposte possibili. "Modifica" non è un ornamento tra accetta e
 * rifiuta: una proposta è spesso giusta per metà, e senza una terza via l'utente rifiuterebbe e rifarebbe tutto a
 * mano. Niente più una sezione "Proposte" a sé: queste righe vivono dentro "Letto dal dispositivo" o "Analisi con
 * Hinthia" (v. ArchiveItemDetail.tsx, che sceglie il sottoinsieme --- locali o di Hinthia --- e mostra l'eventuale
 * annullamento una volta sola, sopra le tab, non qui: un annullamento non deve sparire cambiando tab).
 */

const KIND_LABEL: Record<ProposalKind, string> = {
  expiry: "Scadenza",
  category: "Categoria",
  issuer: "Emittente",
  field: "Campo",
  event: "Da ricordare",
  asset: "Bene",
};

const KIND_ICON: Record<ProposalKind, string> = {
  expiry: "⏳",
  category: "🏷️",
  issuer: "🏛️",
  field: "🧩",
  event: "📅",
  asset: "🔗",
};

/** Per "field" l'etichetta viene dal vocabolario (es. "Numero polizza"), non dal generico "Campo" --- più informativa. */
function kindLabel(proposal: Proposal): string {
  if (proposal.kind === "field") return proposal.fieldLabel ?? KIND_LABEL.field;
  return KIND_LABEL[proposal.kind];
}

/** Identità di una proposta per lo stato di modifica, non solo il tipo: con più candidati dello stesso tipo, "sto modificando la scadenza" da solo non dice QUALE. Per "field" anche la chiave, altrimenti due campi diversi con lo stesso valore collisionerebbero. */
function proposalKey(proposal: Proposal): string {
  return `${proposal.kind}:${proposal.fieldKey ?? ""}:${proposal.value}`;
}

export interface UndoableAction {
  message: string;
  onUndo: () => void;
}

export function ProposalsSection({
  proposals,
  categories,
  assets = [],
  busy,
  onAccept,
  onReject,
  acceptAllCount = 0,
  onAcceptAll,
}: {
  proposals: Proposal[];
  categories: Category[];
  /** I beni, per mostrare il nome di quello proposto e per scegliere un altro in "Modifica". */
  assets?: AssetListItem[];
  busy: boolean;
  /** `value` può differire da `proposal.value`: è il percorso di "Modifica". */
  onAccept: (proposal: Proposal, value: string) => void;
  onReject: (proposal: Proposal) => void;
  /** Quante informazioni accetterebbe "Accetta tutto" (una per tipo): con meno di due il pulsante non serve. */
  acceptAllCount?: number;
  onAcceptAll?: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (proposals.length === 0) return null;

  function startEditing(proposal: Proposal) {
    setEditing(proposalKey(proposal));
    setDraft(proposal.value);
  }

  function displayValue(proposal: Proposal): string {
    if (proposal.kind === "expiry") return formatDate(proposal.value);
    if (proposal.kind === "event") return `${proposal.eventTitle ?? "Evento"}, ${formatDate(proposal.value)}`;
    if (proposal.kind === "issuer" || proposal.kind === "field") return proposal.value;
    if (proposal.kind === "asset") {
      if (proposal.createAsset) return `Nuovo bene: ${proposal.value}`;
      return assets.find((a) => a.id === proposal.value)?.name ?? "Bene";
    }
    return categories.find((c) => c.id === proposal.value)?.name ?? proposal.value;
  }

  return (
    <div className="flex flex-col gap-3">
      {onAcceptAll && acceptAllCount >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Hinthia ha trovato {acceptAllCount} informazioni da aggiungere alla Scheda.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onAcceptAll}
            className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            Accetta tutto
          </button>
        </div>
      ) : null}
      {proposals.map((proposal) => {
        const isEditing = editing === proposalKey(proposal);

        return (
          <div
            key={proposalKey(proposal)}
            className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand/5 p-3"
          >
            <div className="flex gap-3">
              <span aria-hidden="true" className="mt-0.5 shrink-0 text-base">
                {KIND_ICON[proposal.kind]}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {kindLabel(proposal)}
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
                  {proposal.page ? (
                    <span className="mr-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 not-italic dark:bg-zinc-800 dark:text-zinc-300">
                      Pagina {proposal.page}
                    </span>
                  ) : null}
                  {proposal.source}
                </p>
              </div>
            </div>

            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                {proposal.kind === "expiry" ||
                proposal.kind === "event" ||
                (proposal.kind === "field" && inferFieldInputType(proposal.value) === "date") ? (
                  <input
                    type="date"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label={`${kindLabel(proposal)} da impostare`}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                ) : proposal.kind === "issuer" || proposal.kind === "field" ? (
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label={`${kindLabel(proposal)} da impostare`}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                ) : proposal.kind === "asset" && proposal.createAsset ? (
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Nome del bene da creare"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                ) : proposal.kind === "asset" ? (
                  <select
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Bene da collegare"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  >
                    {sortAlphabetically(assets, (a) => a.name).map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
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
                  {proposal.kind === "event" ? "Aggiungi a Scadenze" : proposal.kind === "asset" ? (proposal.createAsset ? "Crea e collega" : "Collega") : "Accetta"}
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

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Quello che rifiuti non te lo richiedo più. Ogni scelta resta in Attività.
      </p>
    </div>
  );
}
