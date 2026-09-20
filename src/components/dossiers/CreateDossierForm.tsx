"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createDossier } from "@/domain/dossiers/repository";

/**
 * FASE 20 --- creazione di un fascicolo: solo titolo e descrizione. Lo
 * stato nasce sempre "aperto" (si chiude dalla scheda del fascicolo,
 * un'azione a sé --- v. DossierDetail); i documenti si collegano dal
 * loro stesso form, non da qui (stesso schema di beni e categorie: si
 * assegna dal lato del documento, mai dal lato dell'oggetto).
 */
export function CreateDossierForm({ masterKey }: { masterKey: CryptoKey }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title) {
      setError("Inserisci un titolo per il fascicolo.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createDossier(supabase, masterKey, user.id, { title, description });
      router.push("/dossiers?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare il fascicolo.");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dossiers"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai fascicoli
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">Nuovo fascicolo</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Una vicenda che attraversa più categorie --- un problema di salute, l&apos;acquisto di una
          casa, un incidente. I documenti si collegano dal loro stesso form, con &laquo;Fascicolo&raquo;.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
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
            placeholder="es. Intervento al ginocchio"
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
            placeholder="Facoltativa: qualche riga per ricordarti di cosa si tratta."
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
            disabled={creating}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {creating ? "Creazione…" : "Crea fascicolo"}
          </button>
          <Link
            href="/dossiers"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </Link>
        </div>
      </form>
    </div>
  );
}
