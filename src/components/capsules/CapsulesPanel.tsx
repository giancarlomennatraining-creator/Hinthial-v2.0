"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/db/supabase/client";
import {
  deleteCapsule,
  downloadCapsuleAttachment,
  listCapsules,
  setCapsuleStatus,
  updateCapsule,
} from "@/domain/capsules/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { downloadDocument, listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { sortAlphabetically } from "@/lib/utils";
import { saveBytesAsFile } from "@/lib/download";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { ContactPicker } from "@/components/capsules/ContactPicker";
import type { CapsuleAttachment, CapsuleListItem, CapsuleStatus } from "@/domain/capsules/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<CapsuleStatus, string> = {
  draft: "Bozza",
  ready: "Chiusa",
  shared: "Condivisa",
};

const STATUS_BADGE_CLASS: Record<CapsuleStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  ready: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  shared: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
};

/**
 * FASE 8 --- Capsule digitali v1: titolo, contenuto, allegati, data di
 * apertura facoltativa (tutto cifrato) e uno o più destinatari; stato
 * manuale bozza -> chiusa -> condivisa. Chiudere è l'unico passaggio
 * irreversibile: la capsula non è più modificabile e i documenti
 * collegati non sono più cancellabili da Documenti finché la capsula
 * esiste (v. domain/capsules/types.ts, lockedDocumentIds). Nessun Dead
 * Man's Switch --- chiudere blocca i contenuti ma non concede ancora
 * alcun accesso ai destinatari (v. HINTHIAL_MVP.md).
 */
export function CapsulesPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [capsules, setCapsules] = useState<CapsuleListItem[]>([]);
  const [contacts, setContacts] = useState<TrustedContactListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAttachment, setBusyAttachment] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editOpenAt, setEditOpenAt] = useState("");
  const [editRelatedContacts, setEditRelatedContacts] = useState<TrustedContactListItem[]>([]);
  const [editLinkedDocuments, setEditLinkedDocuments] = useState<DocumentListItem[]>([]);

  // "?created=1" arriva dalla pagina di creazione dedicata (/capsules/new)
  // dopo un salvataggio riuscito --- solo un flag, mai il titolo o altro
  // contenuto della capsula (finirebbe in chiaro nell'URL/cronologia).
  // Letto una sola volta all'avvio (stato pigro): il messaggio non deve
  // sparire quando subito dopo ripuliamo l'URL con router.replace.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  useEffect(() => {
    if (showCreatedMessage) router.replace("/capsules");
  }, [showCreatedMessage, router]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [capsulesResult, contactsResult, categoriesResult, documentsResult] = await Promise.all([
        listCapsules(supabase, masterKey),
        listTrustedContacts(supabase, masterKey),
        listCategories(supabase),
        listDocuments(supabase, masterKey),
      ]);
      setCapsules(capsulesResult);
      setContacts(contactsResult);
      setCategories(categoriesResult);
      setDocuments(documentsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare le capsule.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function startEditing(capsule: CapsuleListItem) {
    setEditingId(capsule.id);
    setEditTitle(capsule.title);
    setEditContent(capsule.content);
    setEditOpenAt(capsule.openAt ?? "");
    setEditRelatedContacts(capsule.relatedContacts);
    setEditLinkedDocuments(capsule.linkedDocuments);
  }

  async function handleSaveEdit(capsule: CapsuleListItem) {
    if (!editTitle.trim()) {
      setError("Il titolo della capsula non può essere vuoto.");
      return;
    }

    setBusyId(capsule.id);
    setError(null);
    try {
      await updateCapsule(supabase, masterKey, capsule.id, capsule.attachments, {
        title: editTitle.trim(),
        content: editContent.trim(),
        relatedContactIds: editRelatedContacts.map((c) => c.id),
        linkedDocumentIds: editLinkedDocuments.map((d) => d.id),
        openAt: editOpenAt || null,
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdvance(capsule: CapsuleListItem, status: CapsuleStatus) {
    if (status === "ready") {
      const documentNote =
        capsule.linkedDocuments.length > 0
          ? " I documenti collegati non potranno più essere cancellati da Documenti finché la capsula esiste."
          : "";
      if (
        !window.confirm(
          `Chiudere la capsula "${capsule.title}"? Non sarà più modificabile.${documentNote}`,
        )
      )
        return;
    }

    setBusyId(capsule.id);
    setError(null);
    try {
      await setCapsuleStatus(supabase, capsule.id, status);
      setCapsules((prev) => prev.map((c) => (c.id === capsule.id ? { ...c, status } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare lo stato della capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(capsule: CapsuleListItem) {
    if (!window.confirm(`Eliminare la capsula "${capsule.title}"? L'operazione non è reversibile.`))
      return;

    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteCapsule(supabase, user.id, capsule);
      setCapsules((prev) => prev.filter((c) => c.id !== capsule.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare la capsula.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenAttachment(capsule: CapsuleListItem, attachment: CapsuleAttachment) {
    setBusyAttachment(attachment.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const { filename, mimeType, bytes } = await downloadCapsuleAttachment(
        supabase,
        masterKey,
        user.id,
        capsule.id,
        attachment,
      );
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire l'allegato.");
    } finally {
      setBusyAttachment(null);
    }
  }

  /** Same download path Documenti itself uses --- a linked document is never copied, just referenced. */
  async function handleOpenLinkedDocument(doc: DocumentListItem) {
    setBusyAttachment(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il documento.");
    } finally {
      setBusyAttachment(null);
    }
  }

  // Solo contatti fiduciari ATTIVI possono essere scelti come destinatario.
  const activeContacts = contacts.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Capsule
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Contenuti cifrati da lasciare a uno o più destinatari, in condizioni definite da te.
            Chiudere una capsula è irreversibile: non sarà più modificabile e i documenti collegati
            non potranno più essere cancellati finché la capsula esiste. Non concede però ancora
            alcun accesso ai destinatari --- l&apos;apertura vera e propria arriverà con una fase
            futura.
          </p>
        </div>
        <Link
          href="/capsules/new"
          className="shrink-0 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
        >
          + Crea capsula
        </Link>
      </div>

      {showCreatedMessage ? (
        <p className="text-sm text-lime-700 dark:text-lime-400">✅ Capsula creata.</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : capsules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessuna capsula ancora. Creane una col tasto qui sopra.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {capsules.map((capsule) => {
            const busy = busyId === capsule.id;
            const isEditing = editingId === capsule.id;

            if (isEditing) {
              return (
                <li key={capsule.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap gap-3">
                    <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                      <label
                        htmlFor={`edit-${capsule.id}-title`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        Titolo
                      </label>
                      <input
                        id={`edit-${capsule.id}-title`}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`edit-${capsule.id}-openAt`}
                        className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        Data di apertura (facoltativa)
                      </label>
                      <input
                        id={`edit-${capsule.id}-openAt`}
                        type="date"
                        value={editOpenAt}
                        onChange={(e) => setEditOpenAt(e.target.value)}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                      />
                    </div>
                  </div>

                  <ContactPicker
                    idPrefix={`edit-${capsule.id}`}
                    contacts={activeContacts}
                    selected={editRelatedContacts}
                    onChange={setEditRelatedContacts}
                  />

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`edit-${capsule.id}-content`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      Contenuto
                    </label>
                    <textarea
                      id={`edit-${capsule.id}-content`}
                      rows={3}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </div>

                  <DocumentAttachmentPicker
                    idPrefix={`edit-${capsule.id}`}
                    categories={categories}
                    documents={documents}
                    selected={editLinkedDocuments}
                    onChange={setEditLinkedDocuments}
                  />

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveEdit(capsule)}
                      className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                    >
                      {busy ? "Salvataggio…" : "Salva"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingId(null)}
                      className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                    >
                      Annulla
                    </button>
                  </div>
                </li>
              );
            }

            return (
              <li key={capsule.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {capsule.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[capsule.status]}`}
                      >
                        {STATUS_LABEL[capsule.status]}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {capsule.relatedContacts.length > 0
                        ? `Per ${sortAlphabetically(capsule.relatedContacts, (c) => c.name)
                            .map((c) => c.name)
                            .join(", ")} · `
                        : ""}
                      dal {formatDate(capsule.createdAt)}
                      {capsule.openAt ? ` · apertura prevista ${formatDate(capsule.openAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    {capsule.status === "draft" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEditing(capsule)}
                        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                      >
                        Modifica
                      </button>
                    ) : null}
                    {capsule.status === "draft" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdvance(capsule, "ready")}
                        className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                      >
                        Chiudi la capsula
                      </button>
                    ) : null}
                    {capsule.status === "ready" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAdvance(capsule, "shared")}
                        className="text-sm font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50"
                      >
                        Condividi
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(capsule)}
                      className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      Elimina
                    </button>
                  </div>
                </div>

                {capsule.content ? (
                  <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                    {capsule.content}
                  </p>
                ) : null}

                {capsule.attachments.length > 0 || capsule.linkedDocuments.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {capsule.attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900"
                      >
                        <span className="truncate text-zinc-700 dark:text-zinc-300">
                          📎 {attachment.filename} · {formatSize(attachment.size)}
                        </span>
                        <button
                          type="button"
                          disabled={busyAttachment === attachment.id}
                          onClick={() => handleOpenAttachment(capsule, attachment)}
                          className="shrink-0 font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                        >
                          {busyAttachment === attachment.id ? "Apertura…" : "Apri"}
                        </button>
                      </li>
                    ))}
                    {capsule.linkedDocuments.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900"
                      >
                        <span className="truncate text-zinc-700 dark:text-zinc-300">
                          📄 {doc.filename} · {formatSize(doc.size)}
                        </span>
                        <button
                          type="button"
                          disabled={busyAttachment === doc.id}
                          onClick={() => handleOpenLinkedDocument(doc)}
                          className="shrink-0 font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                        >
                          {busyAttachment === doc.id ? "Apertura…" : "Apri"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
