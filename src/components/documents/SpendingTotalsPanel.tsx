"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { totalsByYearAndCategory } from "@/domain/bulk-import/totals";
import { formatAmount } from "@/lib/format";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

/**
 * FASE 21 --- "totali di spesa per anno e categoria": una lettura, non
 * un cruscotto. Somma soltanto --- nessun confronto tra anni, nessuna
 * soglia che segnali uno scostamento. Se un anno vale più degli altri, è
 * un fatto che l'utente nota da sé guardando la tabella; non è compito
 * di questa pagina dirglielo.
 *
 * Calcolato al volo sul testo già decifrato in memoria (come tutto ciò
 * che viene dalla FASE 18): nessuna tabella dedicata, nessuna migrazione
 * se la logica di riconoscimento degli importi cambia.
 */
export function SpendingTotalsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [documentsResult, categoriesResult] = await Promise.all([
        listDocuments(supabase, masterKey),
        listCategories(supabase),
      ]);
      setDocuments(documentsResult);
      setCategories(categoriesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i totali.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const totals = totalsByYearAndCategory(documents);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
          Totali di spesa
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          La somma degli importi che Hinthial ha riconosciuto nei tuoi documenti, per anno e
          categoria --- calcolata sul tuo dispositivo. Solo numeri: nessun confronto, nessun
          giudizio su cosa sia troppo o troppo poco.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : totals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun importo riconosciuto ancora. Compare qui appena Hinthial ne trova uno in un
            documento --- una fattura, uno scontrino, una ricevuta.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="p-3">Anno</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Documenti</th>
                <th className="p-3">Totale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {totals.map((row) => {
                const category = categories.find((c) => c.id === row.categoryId);
                return (
                  <tr key={`${row.year}:${row.categoryId ?? ""}`}>
                    <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">{row.year}</td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">
                      {category ? `${category.icon} ${category.name}` : "Senza categoria"}
                    </td>
                    <td className="p-3 text-zinc-600 dark:text-zinc-400">{row.documentCount}</td>
                    <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {formatAmount(row.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
