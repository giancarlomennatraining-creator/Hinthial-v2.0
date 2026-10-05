"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getLocalUserId } from "@/lib/auth/local-user";
import { listTypeCategoryOverrides, resetTypeCategory, setTypeCategory } from "@/domain/categories/type-categories";
import type { Category } from "@/domain/categories/types";
import { defaultCategoryNameFor, type TypeCategoryOverrides } from "@/domain/ai/analysis/category-defaults";
import { ANALYSIS_DOCUMENT_TYPES, ANALYSIS_SCHEMAS } from "@/domain/ai/analysis/schemas";

const USE_DEFAULT = "";
const NONE = "none";

/**
 * "Categoria proposta per tipo di documento": quando Hinthia legge un documento e il modello non propone una categoria,
 * se ne propone una in base al tipo riconosciuto. Qui l'utente cambia la corrispondenza: una categoria sua, "nessuna", o
 * la predefinita.
 */
export function DocumentTypeCategoriesPanel({ categories }: { categories: Category[] }) {
  const supabase = useRef(createClient()).current;
  const [overrides, setOverrides] = useState<TypeCategoryOverrides>({});
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setOverrides(await listTypeCategoryOverrides(supabase));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le scelte.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Fetch-on-mount legittimo come nel resto delle Impostazioni.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  /** Il valore della select per un tipo: "" = predefinita, "none" = nessuna, altrimenti l'id della categoria. */
  function selectedFor(type: string): string {
    if (!Object.prototype.hasOwnProperty.call(overrides, type)) return USE_DEFAULT;
    const chosen = overrides[type];
    if (chosen === null) return NONE;
    // Una scelta che punta a una categoria sparita equivale alla predefinita.
    return categories.some((category) => category.id === chosen) ? chosen : USE_DEFAULT;
  }

  async function handleChange(type: string, value: string) {
    setBusyType(type);
    setError(null);
    try {
      if (value === USE_DEFAULT) {
        await resetTypeCategory(supabase, type);
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
      } else {
        const ownerId = await getLocalUserId(supabase);
        if (!ownerId) throw new Error("Devi essere autenticato.");
        const categoryId = value === NONE ? null : value;
        await setTypeCategory(supabase, ownerId, type, categoryId);
        setOverrides((prev) => ({ ...prev, [type]: categoryId }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la scelta.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <section aria-label="Categoria proposta per tipo di documento" className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Categoria proposta per tipo di documento</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Quando Hinthia legge un documento e non propone una categoria, ne propone una in base al tipo che ha
          riconosciuto. Qui scegli quale. La proposta resta sempre da accettare.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {ANALYSIS_DOCUMENT_TYPES.map((type) => {
            const label = ANALYSIS_SCHEMAS[type].label;
            const defaultName = defaultCategoryNameFor(type);
            const id = `type-category-${type}`;
            return (
              <li key={type} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {label}
                </label>
                <select
                  id={id}
                  value={selectedFor(type)}
                  disabled={busyType === type}
                  onChange={(event) => handleChange(type, event.target.value)}
                  className="w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 disabled:opacity-60 sm:w-auto dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                >
                  <option value={USE_DEFAULT}>
                    {defaultName ? `Predefinita: ${defaultName}` : "Predefinita: nessuna"}
                  </option>
                  <option value={NONE}>Nessuna categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
