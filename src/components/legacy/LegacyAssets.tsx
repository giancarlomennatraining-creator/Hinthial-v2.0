"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listAssets, setAssetLegacyNote } from "@/domain/assets/repository";
import type { AssetListItem } from "@/domain/assets/types";
import { useToast } from "@/components/ui/ToastProvider";
import { sortAlphabetically } from "@/lib/utils";
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/**
 * "I tuoi beni": per ogni bene, cosa succede se non ci sei più (a chi va, dove sono le chiavi, chi chiamare). È una nota
 * cifrata che vedi solo tu: da sola non arriva a nessuno. Per farla arrivare a qualcuno si scrive in una capsula, che
 * l'Eredità digitale consegna. Richiede la master key: i nomi dei beni sono cifrati.
 */
export function LegacyAssets({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const showToast = useToast();
  const [assets, setAssets] = useState<AssetListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await listAssets(supabase, masterKey);
        if (!cancelled) setAssets(loaded);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare i beni.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, masterKey]);

  function startEditing(asset: AssetListItem) {
    setEditingId(asset.id);
    setDraft(asset.legacyNote);
    setError(null);
  }

  async function save(asset: AssetListItem) {
    setSaving(true);
    setError(null);
    try {
      await setAssetLegacyNote(supabase, masterKey, asset.id, draft);
      const note = draft.trim();
      setAssets((prev) => (prev ?? []).map((a) => (a.id === asset.id ? { ...a, legacyNote: note } : a)));
      setEditingId(null);
      showToast(note ? "Nota salvata." : "Nota tolta.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile salvare la nota.");
    } finally {
      setSaving(false);
    }
  }

  const withNote = (assets ?? []).filter((a) => a.legacyNote !== "").length;

  return (
    <section aria-labelledby="legacy-assets-title" className="flex flex-col gap-4">
      <div>
        <h2 id="legacy-assets-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          I tuoi beni
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          Per ogni bene, scrivi cosa succede se non ci sei più: a chi va, dove sono le chiavi, chi chiamare. La nota resta
          cifrata e la vedi solo tu. Per farla arrivare a qualcuno, scrivila anche in una capsula.{" "}
          <Link href="/capsules/new" className="font-medium text-brand hover:underline">
            Scrivi una capsula →
          </Link>
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {assets === null ? (
        error ? null : <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : assets.length === 0 ? (
        <div className="flex max-w-2xl flex-col items-start gap-2 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Non hai ancora censito nessun bene (casa, veicoli, assicurazioni...).
          </p>
          <Link href="/assets/new" className="text-sm font-semibold text-brand hover:underline">
            Aggiungi un bene →
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {withNote === 0
              ? "Non hai ancora detto cosa succede a nessun bene."
              : `Hai detto cosa succede a ${withNote} ${withNote === 1 ? "bene" : "beni"} su ${assets.length}.`}
          </p>
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {sortAlphabetically(assets, (a) => a.name).map((asset) => (
              <li key={asset.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{asset.name}</span>
                    {editingId !== asset.id ? (
                      asset.legacyNote ? (
                        <span className="whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{asset.legacyNote}</span>
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Non hai detto cosa succede.</span>
                      )
                    ) : null}
                  </span>
                  {editingId !== asset.id ? (
                    <button
                      type="button"
                      onClick={() => startEditing(asset)}
                      aria-label={`${asset.legacyNote ? "Cambia" : "Scrivi"} cosa succede a ${asset.name}`}
                      className="shrink-0 text-xs font-semibold text-brand hover:underline"
                    >
                      {asset.legacyNote ? "Cambia" : "Scrivi"}
                    </button>
                  ) : null}
                </div>
                {editingId === asset.id ? (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={`legacy-note-${asset.id}`} className="sr-only">
                      Cosa succede a {asset.name}
                    </label>
                    <textarea
                      id={`legacy-note-${asset.id}`}
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="es. Va a Luca. Le chiavi sono dal vicino del secondo piano."
                      className={INPUT_FIELD}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => save(asset)} disabled={saving} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                        {saving ? "Salvataggio…" : "Salva"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} disabled={saving} className={BTN_SECONDARY}>
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
