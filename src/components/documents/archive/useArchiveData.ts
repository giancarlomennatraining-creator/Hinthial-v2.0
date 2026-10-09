"use client";

import { useCallback, useEffect, useState } from "react";
import { getLocalUserId } from "@/lib/auth/local-user";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  downloadDocument,
  listDocumentSummaries,
  logDocumentDownloaded,
  moveDocumentsToTrash,
  updateDocumentMetadata,
} from "@/domain/documents/repository";
import { getTrashRetentionDays } from "@/domain/profile/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers, replaceDocumentDossierLinks } from "@/domain/dossiers/repository";
import type { DocumentSummary } from "@/domain/documents/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { Category } from "@/domain/categories/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import { saveBytesAsFile } from "@/lib/download";
import { useToast } from "@/components/ui/ToastProvider";

export type BulkPopover = "category" | "tag" | "dossier" | null;

/**
 * I dati dell'Archivio e le azioni che valgono per ogni vista: caricamento, selezione, azioni su più documenti
 * (categoria, tag, fascicolo, cestino), apertura e eliminazione di uno. Quello che serve solo a elenco e tabella
 * (player inline, note, trascrizione, ordinamento a colonne) resta in DocumentsPanel.
 */
export function useArchiveData(masterKey: CryptoKey) {
  const supabase = useSupabase();
  const showToast = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  // Set (non array): toggle/verifica per id restano O(1) con centinaia di righe.
  // trashRetentionDays è letto una volta all'avvio (non un Provider): cambia di rado.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [trashRetentionDays, setTrashRetentionDays] = useState(15);
  const [bulkPopover, setBulkPopover] = useState<BulkPopover>(null);
  const [bulkTagInput, setBulkTagInput] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      // Tutto in parallelo: prima la conservazione del cestino arrivava dopo, con un `getUser()` e una query in fila, e la pagina restava in caricamento fino ad allora.
      const userId = await getLocalUserId(supabase);
      const [categoriesResult, assetsResult, dossiersResult, documentsResult, trashDays] = await Promise.all([
        listCategories(supabase),
        listAssets(supabase, masterKey),
        listDossiers(supabase, masterKey),
        listDocumentSummaries(supabase, masterKey),
        userId ? getTrashRetentionDays(supabase, userId) : Promise.resolve(null),
      ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
      setDossiers(dossiersResult);
      setDocuments(documentsResult);
      if (trashDays !== null) setTrashRetentionDays(trashDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare l'archivio.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // Legittimo qui: i dati si decifrano solo con la masterKey in memoria, non possono venire da un Server Component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleOpen(doc: DocumentSummary) {
    setBusyDocId(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
      void logDocumentDownloaded(supabase, doc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il contenuto.");
    } finally {
      setBusyDocId(null);
    }
  }

  /** L'eliminazione sposta nel Cestino, non elimina più per sempre: farlo su più documenti insieme moltiplica il rischio di un clic distratto. */
  async function handleDelete(doc: DocumentSummary) {
    if (
      !window.confirm(
        `Spostare "${doc.filename}" nel cestino? Potrai ripristinarlo entro ${trashRetentionDays} giorni, da Archivio → Cestino.`,
      )
    )
      return;

    setBusyDocId(doc.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await moveDocumentsToTrash(supabase, user.id, [doc.id], trashRetentionDays);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setSelectedIds((prev) => {
        if (!prev.has(doc.id)) return prev;
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile spostare il contenuto nel cestino.");
    } finally {
      setBusyDocId(null);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkPopover(null);
  }

  const selectedDocuments = documents.filter((doc) => selectedIds.has(doc.id));

  async function handleBulkDelete() {
    const count = selectedDocuments.length;
    if (count === 0) return;
    if (
      !window.confirm(
        `Spostare ${count} ${count === 1 ? "documento" : "documenti"} nel cestino? Potrai ripristinarli entro ${trashRetentionDays} giorni, da Archivio → Cestino.`,
      )
    )
      return;

    setBulkBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const ids = selectedDocuments.map((doc) => doc.id);
      await moveDocumentsToTrash(supabase, user.id, ids, trashRetentionDays);
      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
      showToast(`${count} ${count === 1 ? "documento spostato" : "documenti spostati"} nel cestino.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile spostare nel cestino.");
    } finally {
      setBulkBusy(false);
    }
  }

  /** updateDocumentMetadata sovrascrive l'intero input insieme (v. domain/documents/repository.ts): si parte dal documento già in memoria e se ne cambia solo il campo che conta. */
  async function handleBulkCategory(categoryId: string) {
    setBulkBusy(true);
    setError(null);
    try {
      for (const doc of selectedDocuments) {
        await updateDocumentMetadata(supabase, masterKey, doc.id, {
          categoryId,
          relatedAssetId: doc.relatedAssetId,
          dossierIds: doc.dossierIds,
          expiresAt: doc.expiresAt,
          notes: doc.notes,
          tags: doc.tags,
          issuer: doc.issuer,
        });
      }
      await refresh();
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la categoria.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setBulkBusy(true);
    setError(null);
    try {
      for (const doc of selectedDocuments) {
        if (doc.tags.includes(trimmed)) continue; // già presente --- non doppio
        await updateDocumentMetadata(supabase, masterKey, doc.id, {
          categoryId: doc.categoryId,
          relatedAssetId: doc.relatedAssetId,
          dossierIds: doc.dossierIds,
          expiresAt: doc.expiresAt,
          notes: doc.notes,
          tags: [...doc.tags, trimmed],
          issuer: doc.issuer,
        });
      }
      await refresh();
      clearSelection();
      setBulkTagInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il tag.");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDossier(dossierId: string) {
    setBulkBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      for (const doc of selectedDocuments) {
        if (doc.dossierIds.includes(dossierId)) continue; // già dentro --- non doppio
        await replaceDocumentDossierLinks(supabase, user.id, doc.id, [...doc.dossierIds, dossierId]);
      }
      await refresh();
      clearSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere al fascicolo.");
    } finally {
      setBulkBusy(false);
    }
  }

  function categoryFor(doc: DocumentSummary): Category | undefined {
    return categories.find((c) => c.id === doc.categoryId);
  }

  function assetFor(doc: DocumentSummary): AssetListItem | undefined {
    return assets.find((a) => a.id === doc.relatedAssetId);
  }

  return {
    supabase,
    masterKey,
    categories,
    assets,
    dossiers,
    documents,
    setDocuments,
    loading,
    error,
    setError,
    refresh,
    busyDocId,
    setBusyDocId,
    trashRetentionDays,
    selectedIds,
    setSelectedIds,
    selectedDocuments,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    bulkBusy,
    bulkPopover,
    setBulkPopover,
    bulkTagInput,
    setBulkTagInput,
    handleOpen,
    handleDelete,
    handleBulkDelete,
    handleBulkCategory,
    handleBulkTag,
    handleBulkDossier,
    categoryFor,
    assetFor,
  };
}

export type ArchiveData = ReturnType<typeof useArchiveData>;
