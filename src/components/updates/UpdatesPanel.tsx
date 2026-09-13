"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listProductUpdates } from "@/domain/product-updates/repository";
import { ListSkeleton } from "@/components/ui/Skeleton";
import type { ProductUpdateListItem } from "@/domain/product-updates/types";

const PREVIEW_COUNT = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "Novità" --- voce di menu a sé (non più una card in Dashboard, v.
 * richiesta utente), stessa impostazione di Cronologia ma senza filtri:
 * una tabella con le ultime 10 modifiche a Hinthial (già dalla più
 * recente), e un tasto "Vedi tutte" per le altre. L'intero registro è
 * poche decine di righe --- caricato una volta sola qui, "Vedi tutte" si
 * limita a mostrare il resto di ciò che è già arrivato, nessuna nuova
 * richiesta di rete. Contenuto globale, non cifrato: non richiede la
 * master key (v. page.tsx).
 */
export function UpdatesPanel() {
  const [supabase] = useState(() => createClient());
  const [updates, setUpdates] = useState<ProductUpdateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

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

  const visibleUpdates = showAll ? updates : updates.slice(0, PREVIEW_COUNT);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand">Novità</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Le modifiche fatte a Hinthial nel tempo, dalla più recente.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : loading ? (
        <ListSkeleton />
      ) : updates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Ancora nulla da raccontare.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="p-3">Novità</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {visibleUpdates.map((update) => (
                  <tr key={update.id}>
                    <td className="p-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{update.title}</p>
                      <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">{update.description}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                      {formatDate(update.publishedOn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!showAll && updates.length > PREVIEW_COUNT ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Vedi tutte ({updates.length})
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
