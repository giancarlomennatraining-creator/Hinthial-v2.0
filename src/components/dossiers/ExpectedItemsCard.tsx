"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExpectedStatus, ExpectedSummary } from "@/domain/dossiers/expected";
import { CARD, CARD_TITLE, SMALL_BUTTON, TEXT_INPUT } from "@/components/dossiers/styles";

/**
 * I documenti che ti aspetti di trovare nel fascicolo. Una voce si spunta da sola quando c'è un documento che la nomina
 * (v. domain/dossiers/expected.ts); altrimenti si spunta a mano.
 */
export function ExpectedItemsCard({
  expected,
  busy,
  onAdd,
  onToggle,
  onDelete,
}: {
  expected: ExpectedSummary;
  busy: boolean;
  /** Più nomi separati da virgola o a capo diventano più voci. */
  onAdd: (labels: string[]) => void;
  onToggle: (status: ExpectedStatus, checked: boolean) => void;
  onDelete: (status: ExpectedStatus) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const labels = text
      .split(/[,\n]/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    onAdd(labels);
    setText("");
  }

  return (
    <section aria-label="Documenti attesi" className={CARD}>
      <div className="flex items-baseline justify-between">
        <h2 className={CARD_TITLE}>Documenti attesi</h2>
        {expected.total > 0 ? (
          <span className="text-xs font-bold text-[#5b6483] dark:text-zinc-400">
            {expected.done} di {expected.total}
          </span>
        ) : null}
      </div>
      {expected.total > 0 ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-[#eef0f8] dark:bg-zinc-900" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#1c7c5a]" style={{ width: `${(expected.done / expected.total) * 100}%` }} />
        </div>
      ) : null}
      <ul className="flex flex-col">
        {expected.statuses.map((status) => (
          <li key={status.item.id} className="flex items-start gap-2.5 border-t border-[#eef0f8] py-2 first:border-t-0 first:pt-0 dark:border-zinc-900">
            <input
              type="checkbox"
              checked={status.satisfied}
              // Una voce abbinata a un documento non si disattiva da qui: toglierla è un'altra cosa.
              disabled={busy || status.documentId !== null}
              onChange={(e) => onToggle(status, e.target.checked)}
              aria-label={`${status.item.label}: fatto`}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1c7c5a]"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`text-sm leading-snug font-semibold ${status.satisfied ? "text-[#5b6483] line-through dark:text-zinc-500" : ""}`}>
                {status.item.label}
              </span>
              {status.documentId ? (
                <Link href={`/archive/${status.documentId}`} className="truncate text-xs font-bold text-[#1c7c5a] hover:underline">
                  {status.documentName}
                </Link>
              ) : null}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(status)}
              aria-label={`Togli ${status.item.label}`}
              className="shrink-0 rounded-md px-1.5 text-base leading-none text-[#8a91ad] hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Referto, fattura…"
          aria-label="Aggiungi un documento atteso"
          className={`${TEXT_INPUT} flex-1`}
        />
        <button type="button" disabled={busy || !text.trim()} onClick={submit} className={SMALL_BUTTON}>
          Aggiungi
        </button>
      </div>
      <p className="text-[11.5px] leading-snug text-[#8a91ad] dark:text-zinc-500">
        Una voce si spunta da sola quando nel fascicolo c&apos;è un documento che la nomina.
      </p>
    </section>
  );
}
