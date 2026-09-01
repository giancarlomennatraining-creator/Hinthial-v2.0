"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createTrustedContact } from "@/domain/contacts/repository";

/**
 * Pagina dedicata alla creazione di un contatto fiduciario (estratta da
 * TrustedContactsPanel). Stesso pattern usato per capsule/asset/scadenze:
 * alla creazione riuscita torna a /contacts con un messaggio di conferma
 * passato come flag nell'URL (`?created=1`), mai il nome --- finirebbe
 * in chiaro nella cronologia del browser.
 */
export function CreateContactForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();

    if (!name || !email || !role) {
      setError("Compila nome, email e ruolo.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createTrustedContact(supabase, masterKey, user.id, { name, email, role });
      router.push("/contacts?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il contatto fiduciario.");
      setCreating(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/contacts"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna ai contatti
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Nuovo contatto fiduciario
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Una persona che potrà essere autorizzata in futuro ad accedere ai tuoi dati. Per ora
          questa sezione registra solo il contatto e il suo stato --- nessun accesso viene
          concesso automaticamente.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <label htmlFor="name" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="es. Maria Rossi"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <label htmlFor="email" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="maria.rossi@esempio.it"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="role" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Ruolo
          </label>
          <input
            id="role"
            name="role"
            type="text"
            required
            placeholder="es. Coniuge"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </div>

        {error ? (
          <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {creating ? "Aggiunta…" : "Aggiungi contatto"}
        </button>
        <Link
          href="/contacts"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Annulla
        </Link>
      </form>
    </div>
  );
}
