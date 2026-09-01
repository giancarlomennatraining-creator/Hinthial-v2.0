"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createCapsule } from "@/domain/capsules/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { ContactPicker } from "@/components/capsules/ContactPicker";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

/**
 * Pagina dedicata alla creazione di una capsula (estratta da
 * CapsulesPanel, che ora mostra solo l'elenco più un tasto "Crea
 * capsula"). Alla creazione riuscita torna a /capsules con un messaggio
 * di conferma --- passato come semplice flag nell'URL (`?created=1`),
 * mai il titolo o altro contenuto della capsula: finirebbe in chiaro
 * nella cronologia del browser, in contrasto con lo zero-knowledge.
 */
export function CreateCapsuleForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [contacts, setContacts] = useState<TrustedContactListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingRelatedContacts, setPendingRelatedContacts] = useState<TrustedContactListItem[]>(
    [],
  );
  const [pendingLinkedDocuments, setPendingLinkedDocuments] = useState<DocumentListItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [contactsResult, categoriesResult, documentsResult] = await Promise.all([
        listTrustedContacts(supabase, masterKey),
        listCategories(supabase),
        listDocuments(supabase, masterKey),
      ]);
      setContacts(contactsResult);
      setCategories(categoriesResult);
      setDocuments(documentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i dati necessari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const openAt = String(formData.get("openAt") ?? "") || null;
    const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const linkedDocumentIds = pendingLinkedDocuments.map((d) => d.id);
    const relatedContactIds = pendingRelatedContacts.map((c) => c.id);

    if (!title) {
      setError("Inserisci almeno un titolo.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createCapsule(supabase, masterKey, user.id, {
        title,
        content,
        relatedContactIds,
        files,
        linkedDocumentIds,
        openAt,
      });
      router.push("/capsules?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la capsula.");
      setCreating(false);
    }
  }

  // Solo contatti fiduciari ATTIVI possono essere scelti come destinatario.
  const activeContacts = contacts.filter((c) => c.status === "active");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/capsules"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna alle capsule
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Nuova capsula
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Contenuti cifrati da lasciare a uno o più destinatari, in condizioni definite da te.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Titolo
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                placeholder="es. Per Maria"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="openAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Data di apertura (facoltativa)
              </label>
              <input
                id="openAt"
                name="openAt"
                type="date"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          <ContactPicker
            idPrefix="create"
            contacts={activeContacts}
            selected={pendingRelatedContacts}
            onChange={setPendingRelatedContacts}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="content" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Contenuto
            </label>
            <textarea
              id="content"
              name="content"
              rows={3}
              placeholder="Cosa vuoi lasciare scritto..."
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="files" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Allegati (opzionali)
            </label>
            <input
              ref={fileInputRef}
              id="files"
              name="files"
              type="file"
              multiple
              className="text-sm text-zinc-700 dark:text-zinc-300"
            />
          </div>

          <DocumentAttachmentPicker
            idPrefix="create"
            categories={categories}
            documents={documents}
            selected={pendingLinkedDocuments}
            onChange={setPendingLinkedDocuments}
          />

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating}
              className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? "Creazione…" : "Crea capsula"}
            </button>
            <Link
              href="/capsules"
              className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
