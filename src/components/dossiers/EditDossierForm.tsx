"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listDossiers, updateDossier } from "@/domain/dossiers/repository";
import type { DossierListItem } from "@/domain/dossiers/types";

/**
 * Modifica titolo/descrizione di un fascicolo --- non lo stato
 * (aperto/chiuso), che è un'azione a sé sulla scheda del fascicolo
 * (v. DossierDetail, stesso schema di setReminderCompleted).
 */
export function EditDossierForm({ masterKey, dossierId }: { masterKey: CryptoKey; dossierId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [dossier, setDossier] = useState<DossierListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const dossiers = await listDossiers(supabase, masterKey);
      setDossier(dossiers.find((d) => d.id === dossierId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il fascicolo.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, dossierId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title) {
      setError("Il titolo del fascicolo non può essere vuoto.");
      return;
    }

    setSaving(true);
    try {
      await updateDossier(supabase, masterKey, dossierId, { title, description });
      router.push(`/dossiers/${dossierId}?updated=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il fascicolo.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dossiers/${dossierId}`}
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna al fascicolo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">
          Modifica fascicolo
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !dossier ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Fascicolo non trovato.
        </p>
      ) : (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Titolo
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              defaultValue={dossier.title}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Descrizione
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={dossier.description}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <Link
              href={`/dossiers/${dossierId}`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
