"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { listDocuments, updateDocumentMetadata } from "@/domain/documents/repository";
import { aggregateTags, listIncludesTag, removeTagFromList, renameTagInList } from "@/domain/documents/tags";
import type { DocumentListItem } from "@/domain/documents/types";

/**
 * A differenza di CategoriesPanel, qui non c'è nulla da creare: un tag
 * non è una riga a sé in un database, è solo "qualcosa che uno o più
 * documenti hanno tra i loro tag" (v. domain/documents/tags.ts). Si
 * crea aggiungendolo a un documento in Archivio, non da qui --- questa
 * scheda serve solo a rinominare (con merge automatico se il nuovo nome
 * corrisponde a un tag già esistente) o eliminare un tag ovunque sia
 * usato.
 *
 * Richiede la master key sbloccata (v. SettingsTabs.tsx): a differenza
 * delle categorie, i tag sono cifrati --- l'unico modo di sapere quali
 * esistono è decifrare i documenti che li portano, esattamente come fa
 * già DocumentsPanel per mostrare l'Archivio.
 */
export function TagsSettingsPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setDocuments(await listDocuments(supabase, masterKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i tag.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // Fetch-on-mount legittimo qui come in CategoriesPanel/DocumentsPanel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const tagUsage = aggregateTags(documents);

  function startEditing(name: string) {
    setEditingTag(name);
    setEditValue(name);
  }

  async function handleRename(oldName: string) {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setError("Il nome del tag non può essere vuoto.");
      return;
    }
    if (trimmed === oldName) {
      setEditingTag(null);
      return;
    }

    setBusyTag(oldName);
    setError(null);
    try {
      const affected = documents.filter((doc) => listIncludesTag(doc.tags, oldName));
      for (const doc of affected) {
        await updateDocumentMetadata(supabase, masterKey, doc.id, {
          categoryId: doc.categoryId,
          relatedAssetId: doc.relatedAssetId,
          dossierIds: doc.dossierIds,
          expiresAt: doc.expiresAt,
          notes: doc.notes,
          tags: renameTagInList(doc.tags, oldName, trimmed),
          issuer: doc.issuer,
        });
      }
      await refresh();
      setEditingTag(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile rinominare il tag.");
    } finally {
      setBusyTag(null);
    }
  }

  async function handleDelete(name: string, count: number) {
    const message = `Il tag "${name}" verrà rimosso da ${
      count === 1 ? "1 documento" : `${count} documenti`
    }. I documenti non verranno eliminati, solo il tag. Procedere?`;
    if (!window.confirm(message)) return;

    setBusyTag(name);
    setError(null);
    try {
      const affected = documents.filter((doc) => listIncludesTag(doc.tags, name));
      for (const doc of affected) {
        await updateDocumentMetadata(supabase, masterKey, doc.id, {
          categoryId: doc.categoryId,
          relatedAssetId: doc.relatedAssetId,
          dossierIds: doc.dossierIds,
          expiresAt: doc.expiresAt,
          notes: doc.notes,
          tags: removeTagFromList(doc.tags, name),
          issuer: doc.issuer,
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il tag.");
    } finally {
      setBusyTag(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tag</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          I tag usati nell&apos;Archivio, con quanti documenti li portano. Rinominarne uno che
          corrisponde a un altro già esistente li unisce in uno solo; eliminarlo lo toglie dai
          documenti senza cancellarli. Un tag nuovo si crea aggiungendolo a un documento in
          Archivio, non da qui.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : tagUsage.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nessun tag ancora. I tag si creano aggiungendoli a un documento in Archivio.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {tagUsage.map((tag) => {
            const busy = busyTag === tag.name;
            const isEditing = editingTag === tag.name;

            if (isEditing) {
              return (
                <li key={tag.name} className="flex flex-wrap items-end gap-3 p-4">
                  <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                    <label
                      htmlFor={`edit-tag-${tag.name}`}
                      className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                    >
                      Nome
                    </label>
                    <input
                      id={`edit-tag-${tag.name}`}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRename(tag.name)}
                    className="rounded-xl bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    {busy ? "Salvataggio…" : "Salva"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingTag(null)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Annulla
                  </button>
                </li>
              );
            }

            return (
              <li key={tag.name} className="flex items-center justify-between gap-4 p-4">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  🏷️ {tag.name}{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    · {tag.count === 1 ? "1 documento" : `${tag.count} documenti`}
                  </span>
                </p>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEditing(tag.name)}
                    className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Rinomina
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(tag.name, tag.count)}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-red-400"
                  >
                    {busy ? "Eliminazione…" : "Elimina"}
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
