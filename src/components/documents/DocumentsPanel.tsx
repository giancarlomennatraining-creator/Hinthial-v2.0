"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  updateDocumentMetadata,
  uploadDocument,
} from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listCapsules } from "@/domain/capsules/repository";
import { lockedDocumentIds } from "@/domain/capsules/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import { saveBytesAsFile } from "@/lib/download";
import {
  DocumentMetadataFields,
  EMPTY_METADATA_FIELDS,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function docToFields(doc: DocumentListItem): DocumentMetadataFieldsValue {
  return {
    categoryId: doc.categoryId ?? "",
    relatedAssetId: doc.relatedAssetId ?? "",
    expiresAt: doc.expiresAt ? doc.expiresAt.slice(0, 10) : "",
    notes: doc.notes,
    tagsInput: doc.tags.join(", "),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function expiryStatus(expiresAt: string | null): "none" | "overdue" | "soon" | "ok" {
  if (!expiresAt) return "none";
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / DAY_MS;
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 30) return "soon";
  return "ok";
}

export function DocumentsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  // Documenti referenziati da una capsula chiusa --- non cancellabili da
  // qui finché quella capsula esiste (v. domain/capsules/types.ts).
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [showUploadDetails, setShowUploadDetails] = useState(false);
  const [uploadFields, setUploadFields] = useState<DocumentMetadataFieldsValue>(
    EMPTY_METADATA_FIELDS,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<DocumentMetadataFieldsValue>(
    EMPTY_METADATA_FIELDS,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult, documentsResult, capsulesResult] = await Promise.all([
        listCategories(supabase),
        listAssets(supabase, masterKey),
        listDocuments(supabase, masterKey),
        listCapsules(supabase, masterKey),
      ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDocuments(documentsResult);
      setLockedIds(lockedDocumentIds(capsulesResult));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i documenti.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // Fetching + client-side decryption on mount is legitimate here (not
    // the "derive state from props" anti-pattern this rule targets):
    // the data can only be read/decrypted with the in-memory masterKey,
    // so it can't come from a Server Component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await uploadDocument(supabase, masterKey, user.id, file, {
        categoryId: uploadFields.categoryId || null,
        relatedAssetId: uploadFields.relatedAssetId || null,
        expiresAt: uploadFields.expiresAt || null,
        notes: uploadFields.notes,
        tags: parseTagsInput(uploadFields.tagsInput),
      });
      setUploadFields(EMPTY_METADATA_FIELDS);
      setShowUploadDetails(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il documento.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleOpen(doc: DocumentListItem) {
    setBusyDocId(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il documento.");
    } finally {
      setBusyDocId(null);
    }
  }

  async function handleDelete(doc: DocumentListItem) {
    if (lockedIds.has(doc.id)) {
      setError(
        `"${doc.filename}" fa parte di una capsula chiusa: elimina prima quella capsula per poterlo cancellare.`,
      );
      return;
    }
    if (!window.confirm(`Eliminare "${doc.filename}"? L'operazione non è reversibile.`)) return;

    setBusyDocId(doc.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteDocument(supabase, user.id, doc);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il documento.");
    } finally {
      setBusyDocId(null);
    }
  }

  function startEditing(doc: DocumentListItem) {
    if (lockedIds.has(doc.id)) {
      setError(`"${doc.filename}" fa parte di una capsula chiusa: non è modificabile.`);
      return;
    }
    setEditingId(doc.id);
    setEditFields(docToFields(doc));
  }

  async function handleSaveEdit(doc: DocumentListItem) {
    setBusyDocId(doc.id);
    setError(null);
    try {
      await updateDocumentMetadata(supabase, masterKey, doc.id, {
        categoryId: editFields.categoryId || null,
        relatedAssetId: editFields.relatedAssetId || null,
        expiresAt: editFields.expiresAt || null,
        notes: editFields.notes,
        tags: parseTagsInput(editFields.tagsInput),
      });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il documento.");
    } finally {
      setBusyDocId(null);
    }
  }

  function categoryFor(doc: DocumentListItem): Category | undefined {
    return categories.find((c) => c.id === doc.categoryId);
  }

  function assetFor(doc: DocumentListItem): AssetListItem | undefined {
    return assets.find((a) => a.id === doc.relatedAssetId);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Documenti
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          I tuoi documenti, cifrati sul tuo dispositivo prima di essere caricati.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowUploadDetails((v) => !v)}
            className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            {showUploadDetails ? "Nascondi dettagli" : "+ Categoria, scadenza, tag, note"}
          </button>

          <label className="ml-auto rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            {uploading ? "Caricamento…" : "Aggiungi documento"}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={handleFileSelected}
            />
          </label>
        </div>

        {showUploadDetails ? (
          <DocumentMetadataFields
            idPrefix="upload"
            categories={categories}
            assets={assets}
            value={uploadFields}
            onChange={setUploadFields}
          />
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nessun documento ancora. Aggiungi il tuo primo documento qui sopra.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {documents.map((doc) => {
            const category = categoryFor(doc);
            const asset = assetFor(doc);
            const busy = busyDocId === doc.id;
            const status = expiryStatus(doc.expiresAt);
            const isEditing = editingId === doc.id;
            const locked = lockedIds.has(doc.id);

            if (isEditing) {
              return (
                <li key={doc.id} className="flex flex-col gap-3 p-4">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {doc.filename}
                  </p>
                  <DocumentMetadataFields
                    idPrefix={`edit-${doc.id}`}
                    categories={categories}
                    assets={assets}
                    value={editFields}
                    onChange={setEditFields}
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSaveEdit(doc)}
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
              <li key={doc.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {category ? `${category.icon} ${category.name} · ` : ""}
                    {asset ? `🔗 ${asset.name} · ` : ""}
                    {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                    {doc.expiresAt ? (
                      <>
                        {" · "}
                        <span
                          className={
                            status === "overdue"
                              ? "font-medium text-red-600 dark:text-red-400"
                              : status === "soon"
                                ? "font-medium text-orange-600 dark:text-orange-400"
                                : ""
                          }
                        >
                          scade {formatDate(doc.expiresAt)}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {doc.tags.length > 0 || locked ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {locked ? (
                        <span
                          title="Contenuto in una capsula chiusa: non cancellabile finché quella capsula esiste."
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          🔒 In una capsula chiusa
                        </span>
                      ) : null}
                      {doc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busy || locked}
                    title={locked ? "Contenuto in una capsula chiusa: non modificabile." : undefined}
                    onClick={() => startEditing(doc)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Modifica
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleOpen(doc)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Apri
                  </button>
                  <button
                    type="button"
                    disabled={busy || locked}
                    title={locked ? "Elimina prima la capsula che lo contiene per poterlo cancellare." : undefined}
                    onClick={() => handleDelete(doc)}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
