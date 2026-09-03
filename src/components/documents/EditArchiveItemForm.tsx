"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listDocuments, updateDocumentMetadata } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { contentKindFor, CONTENT_KIND_ICON, CONTENT_KIND_LABEL } from "@/lib/content-kind";
import {
  DocumentMetadataFields,
  documentToFields,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { DocumentListItem } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";

/**
 * Pagina dedicata alla modifica dei metadati di un contenuto d'Archivio
 * --- prima era un form inline nella riga di DocumentsPanel, ora una
 * pagina a sé come la creazione. Solo i metadati sono modificabili qui
 * (categoria, asset, scadenza, tag, note): il file/contenuto originale
 * no, esattamente come già era per l'edit inline --- nome e tipo restano
 * mostrati sola lettura per dare contesto.
 */
export function EditArchiveItemForm({ masterKey, documentId }: { masterKey: CryptoKey; documentId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentListItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [fields, setFields] = useState<DocumentMetadataFieldsValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [documents, assetsResult, categoriesResult] = await Promise.all([
        listDocuments(supabase, masterKey),
        listAssets(supabase, masterKey),
        listCategories(supabase),
      ]);
      const found = documents.find((d) => d.id === documentId) ?? null;
      setDoc(found);
      setFields(found ? documentToFields(found) : null);
      setAssets(assetsResult);
      setCategories(categoriesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare il contenuto.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, documentId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setError(null);
    try {
      await updateDocumentMetadata(supabase, masterKey, documentId, {
        categoryId: fields.categoryId || null,
        relatedAssetId: fields.relatedAssetId || null,
        expiresAt: fields.expiresAt || null,
        notes: fields.notes,
        tags: parseTagsInput(fields.tagsInput),
      });
      router.push("/archive?updated=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare il contenuto.");
      setSaving(false);
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/archive"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna all&apos;archivio
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Modifica contenuto
        </h1>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !doc || !fields ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Contenuto non trovato.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {CONTENT_KIND_LABEL[contentKindFor(doc.mimeType)]} --- il file non è modificabile qui,
              solo i suoi metadati.
            </p>
          </div>

          <DocumentMetadataFields
            idPrefix="edit"
            categories={categories}
            assets={assets}
            value={fields}
            onChange={setFields}
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
              href="/archive"
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
