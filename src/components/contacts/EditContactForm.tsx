"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listTrustedContacts, updateTrustedContact } from "@/domain/contacts/repository";
import type { TrustedContactListItem } from "@/domain/contacts/types";

/**
 * Pagina dedicata alla modifica di un contatto fiduciario --- prima era
 * un form inline nella riga di TrustedContactsPanel, ora una pagina a sé
 * come la creazione (stesso pattern di conferma via `?updated=1`
 * nell'URL, mai il nome in chiaro). Nessun elenco per id già pronto lato
 * repository (come per asset/capsule): si carica l'intero elenco già
 * decifrato e si cerca l'id, esattamente come faceva il pannello prima.
 */
export function EditContactForm({ masterKey, contactId }: { masterKey: CryptoKey; contactId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [contact, setContact] = useState<TrustedContactListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const contacts = await listTrustedContacts(supabase, masterKey);
      setContact(contacts.find((c) => c.id === contactId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il contatto fiduciario.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, contactId]);

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
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "").trim();

    if (!name || !email || !role) {
      setError("Compila nome, email e ruolo.");
      return;
    }

    setSaving(true);
    try {
      await updateTrustedContact(supabase, masterKey, contactId, { name, email, role });
      router.push("/contacts?updated=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il contatto fiduciario.");
      setSaving(false);
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
          Modifica contatto fiduciario
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !contact ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Contatto non trovato.
        </p>
      ) : (
        <form
          onSubmit={handleSave}
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
              defaultValue={contact.name}
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
              defaultValue={contact.email}
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
              defaultValue={contact.role}
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
            disabled={saving}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </button>
          <Link
            href="/contacts"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Annulla
          </Link>
        </form>
      )}
    </div>
  );
}
