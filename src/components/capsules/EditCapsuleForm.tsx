"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listCapsules, updateCapsule } from "@/domain/capsules/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { ContactPicker } from "@/components/capsules/ContactPicker";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import type { CapsuleListItem } from "@/domain/capsules/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

/**
 * Pagina dedicata alla modifica di una capsula --- prima era un form
 * inline nella riga di CapsulesPanel, ora una pagina a sé come la
 * creazione. Solo le capsule ancora in Bozza sono modificabili (v.
 * updateCapsule): chiudere una capsula la rende autosufficiente, non
 * più legata agli originali --- una volta chiusa non ha più senso
 * "modificarla" qui. Gli allegati diretti (audio/video registrati o
 * caricati) restano quelli già presenti: solo titolo, data di apertura,
 * destinatari, contenuto testuale e contenuti collegati dall'Archivio
 * sono modificabili, esattamente come nell'edit inline che sostituisce.
 */
export function EditCapsuleForm({ masterKey, capsuleId }: { masterKey: CryptoKey; capsuleId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [capsule, setCapsule] = useState<CapsuleListItem | null>(null);
  const [activeContacts, setActiveContacts] = useState<TrustedContactListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [relatedContacts, setRelatedContacts] = useState<TrustedContactListItem[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<DocumentListItem[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [capsules, contacts, categoriesResult, documentsResult] = await Promise.all([
        listCapsules(supabase, masterKey),
        listTrustedContacts(supabase, masterKey),
        listCategories(supabase),
        listDocuments(supabase, masterKey),
      ]);
      const found = capsules.find((c) => c.id === capsuleId) ?? null;
      setCapsule(found);
      setActiveContacts(contacts.filter((c) => c.status === "active"));
      setCategories(categoriesResult);
      setDocuments(documentsResult);
      if (found) {
        setTitle(found.title);
        setContent(found.content);
        setOpenAt(found.openAt ?? "");
        setRelatedContacts(found.relatedContacts);
        setLinkedDocuments(found.linkedDocuments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare la capsula.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, capsuleId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleSave() {
    if (!capsule) return;
    if (!title.trim()) {
      setError("Il titolo della capsula non può essere vuoto.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateCapsule(supabase, masterKey, capsuleId, capsule.attachments, {
        title: title.trim(),
        content: content.trim(),
        relatedContactIds: relatedContacts.map((c) => c.id),
        linkedDocumentIds: linkedDocuments.map((d) => d.id),
        openAt: openAt || null,
      });
      router.push("/capsules?updated=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la capsula.");
      setSaving(false);
    }
  }

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
          Modifica capsula
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !capsule ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Capsula non trovata.
        </p>
      ) : capsule.status !== "draft" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Solo le capsule ancora in bozza sono modificabili --- questa è già stata chiusa.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
              <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Titolo
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="openAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Data di apertura (facoltativa)
              </label>
              <input
                id="openAt"
                type="date"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              />
            </div>
          </div>

          <ContactPicker
            idPrefix="edit"
            contacts={activeContacts}
            selected={relatedContacts}
            onChange={setRelatedContacts}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="content" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Contenuto
            </label>
            <textarea
              id="content"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </div>

          <DocumentAttachmentPicker
            idPrefix="edit"
            categories={categories}
            documents={documents}
            selected={linkedDocuments}
            onChange={setLinkedDocuments}
          />

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva modifiche"}
            </button>
            <Link
              href="/capsules"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
