"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import { attentionFor, categoryTiles, sortDocuments } from "@/domain/documents/archive-overview";
import { relativeDay } from "@/domain/documents/archive-views";
import { DocumentCard } from "@/components/documents/archive/DocumentCard";
import { ExpiryPill } from "@/components/documents/archive/parts";
import { PANEL } from "@/components/ui/styles";

const RECENT_COUNT = 8;
/** Quanti riquadri di categoria mostrare prima di "Mostra tutte": la Panoramica deve restare breve. */
const TILES_SHOWN = 8;

/**
 * La Panoramica dell'Archivio: la vista breve, per chi non vuole scorrere sessanta righe. Dice cosa chiede attenzione, mostra
 * le ultime cose aggiunte e porta alle categorie. Tutto il resto è un tocco più in là (Schede, Elenco).
 */
export function ArchiveOverview({
  documents,
  categories,
  masterKey,
  now,
  onCategory,
  onSeeAll,
  onSeeList,
}: {
  documents: DocumentSummary[];
  categories: Category[];
  masterKey: CryptoKey;
  now: Date;
  /** `null` per "Senza categoria". */
  onCategory: (categoryId: string | null) => void;
  onSeeAll: () => void;
  onSeeList: () => void;
}) {
  const attention = attentionFor(documents, now);
  const recent = sortDocuments(documents, "recenti").slice(0, RECENT_COUNT);
  const allTiles = categoryTiles(documents, categories);
  const [showAllTiles, setShowAllTiles] = useState(false);
  const tiles = showAllTiles ? allTiles : allTiles.slice(0, TILES_SHOWN);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const hasAttention = attention.expiring.length > 0 || attention.uncategorized > 0;

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {hasAttention ? (
        <section aria-labelledby="archive-attention" className="flex flex-col gap-3">
          <h2 id="archive-attention" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Da guardare
          </h2>
          <ul className="flex flex-wrap gap-2">
            {attention.expiring.map(({ doc, info }) => (
              <li key={doc.id} className="min-w-0">
                <Link
                  href={`/archive/${doc.id}`}
                  className="flex min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:border-brand dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                >
                  <span className="truncate">{doc.filename}</span>
                  <ExpiryPill info={info} />
                </Link>
              </li>
            ))}
            {attention.expiringTotal > attention.expiring.length ? (
              <li>
                <Link
                  href="/reminders"
                  className="flex items-center rounded-xl px-3 py-2 text-sm font-semibold text-accent hover:bg-brand/10"
                >
                  Tutte le scadenze ({attention.expiringTotal}) →
                </Link>
              </li>
            ) : null}
            {attention.uncategorized > 0 ? (
              <li>
                <button
                  type="button"
                  onClick={() => onCategory(null)}
                  className="flex items-center rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-brand hover:text-accent dark:border-zinc-700 dark:text-zinc-300"
                >
                  {attention.uncategorized}{" "}
                  {attention.uncategorized === 1 ? "contenuto senza categoria" : "contenuti senza categoria"} · sistemali →
                </button>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="archive-recent" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="archive-recent" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Aggiunti di recente
          </h2>
          <button type="button" onClick={onSeeAll} className="text-sm font-semibold text-accent hover:underline">
            Vedi tutti →
          </button>
        </div>
        {/* Una fila che scorre di lato: a colpo d'occhio le ultime cose, senza una pagina intera di righe. */}
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-1 sm:px-1">
          {recent.map((doc) => (
            <li key={doc.id} className="w-44 shrink-0 snap-start sm:w-52">
              <DocumentCard
                doc={doc}
                category={doc.categoryId ? (categoryById.get(doc.categoryId) ?? null) : null}
                masterKey={masterKey}
                now={now}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="archive-categories" className="flex flex-col gap-3">
        <h2 id="archive-categories" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Per categoria
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.id ?? "none"}>
              <button
                type="button"
                onClick={() => onCategory(tile.id)}
                className={`${PANEL} flex w-full items-center gap-3 p-3 text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(16,24,40,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ background: `color-mix(in srgb, ${tile.color} 16%, transparent)` }}
                >
                  {tile.icon}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tile.name}</span>
                  <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {tile.count} {tile.count === 1 ? "contenuto" : "contenuti"}
                    <span className="hidden sm:inline"> · ultimo {relativeDay(tile.lastAt, now)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {allTiles.length > TILES_SHOWN ? (
          <button
            type="button"
            onClick={() => setShowAllTiles((v) => !v)}
            className="self-start text-sm font-semibold text-accent hover:underline"
          >
            {showAllTiles ? "Mostra meno categorie" : `Mostra tutte le categorie (${allTiles.length})`}
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button type="button" onClick={onSeeAll} className="text-sm font-semibold text-accent hover:underline">
          Sfoglia tutti i contenuti ({documents.length}) →
        </button>
        <button type="button" onClick={onSeeList} className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400">
          Vedi come elenco
        </button>
      </div>
    </div>
  );
}
