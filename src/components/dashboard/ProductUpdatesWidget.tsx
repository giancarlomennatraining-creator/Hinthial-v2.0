"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listProductUpdates } from "@/domain/product-updates/repository";
import { SidePanel } from "@/components/ui/SidePanel";
import { SearchInput } from "@/components/ui/SearchInput";
import type { ProductUpdateListItem } from "@/domain/product-updates/types";

const PREVIEW_COUNT = 5;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "Novità" in Dashboard --- le ultime 5 voci del registro prodotto (v.
 * domain/product-updates), con un tasto "Vedi tutte" che apre lo stesso
 * pannello laterale già usato per il dettaglio di un'attività (v.
 * SidePanel), qui con una ricerca (v. SearchInput) invece di un
 * dettaglio a riga: l'intero elenco è poche decine di voci, già
 * caricate tutte insieme --- nessuna query separata all'apertura.
 * Contenuto globale, non cifrato: non richiede la master key, a
 * differenza del resto della dashboard (v. DashboardWidgets).
 */
export function ProductUpdatesWidget() {
  const [supabase] = useState(() => createClient());
  const [updates, setUpdates] = useState<ProductUpdateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await listProductUpdates(supabase);
        if (!cancelled) setUpdates(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare le novità.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered =
    normalizedQuery.length === 0
      ? updates
      : updates.filter(
          (u) =>
            u.title.toLowerCase().includes(normalizedQuery) ||
            u.description.toLowerCase().includes(normalizedQuery),
        );

  if (error) {
    // Non blocca il resto della dashboard --- solo questa sezione resta vuota.
    return null;
  }

  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Novità</h2>
        {updates.length > PREVIEW_COUNT ? (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="shrink-0 text-xs font-medium text-brand hover:underline"
          >
            Vedi tutte
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : updates.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Ancora nulla da raccontare.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {updates.slice(0, PREVIEW_COUNT).map((update) => (
            <li key={update.id} className="min-w-0">
              <p className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{update.title}</span>
                <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {formatDate(update.publishedOn)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{update.description}</p>
            </li>
          ))}
        </ul>
      )}

      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} label="Tutte le novità">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Novità</h2>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            aria-label="Chiudi"
            className="shrink-0 rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Cerca nelle novità…" />
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessuna novità corrisponde alla ricerca.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {filtered.map((update) => (
              <li key={update.id} className="flex flex-col gap-1 py-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{update.title}</span>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDate(update.publishedOn)}
                  </span>
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{update.description}</p>
              </li>
            ))}
          </ul>
        )}
      </SidePanel>
    </section>
  );
}
