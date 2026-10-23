"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  deleteDocument,
  downloadDocument,
  extractTextForExistingDocument,
  logDocumentDownloaded,
} from "@/domain/documents/repository";
import { saveBytesAsFile } from "@/lib/download";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { errorMessage } from "@/lib/utils";
import type { DocumentData } from "@/components/documents/detail/useDocumentData";

/** Le azioni sul contenuto intero: scaricarlo, rileggerlo, eliminarlo. */
export function useDocumentActions(masterKey: CryptoKey, data: DocumentData) {
  const supabase = useSupabase();
  const confirm = useConfirm();
  const router = useRouter();
  const showToast = useToast();
  const { doc, refresh, setError } = data;

  const [busy, setBusy] = useState(false);
  /** L'avanzamento della rilettura (0..1), `null` quando non ne è in corso nessuna. */
  const [rereading, setRereading] = useState<number | null>(null);

  async function handleDownload() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
      void logDocumentDownloaded(supabase, doc.id);
    } catch (err) {
      setError(errorMessage(err, "Impossibile aprire il contenuto."));
    } finally {
      setBusy(false);
    }
  }

  /** Rilegge da zero: l'OCR ha sbagliato, il contenuto è stato caricato prima che si sapesse leggerlo, o è stato letto da una versione precedente che non conservava l'impaginazione. */
  async function handleReread() {
    if (!doc) return;
    setRereading(0);
    setError(null);
    try {
      const { foundText } = await extractTextForExistingDocument(
        supabase,
        masterKey,
        doc,
        (fraction) => setRereading(fraction),
      );
      await refresh();
      showToast(
        foundText ? "Lettura completata." : "L'ho guardato, ma non ci ho trovato testo.",
      );
    } catch (err) {
      setError(errorMessage(err, "Impossibile rileggere il contenuto."));
    } finally {
      setRereading(null);
    }
  }

  async function handleDelete() {
    if (!doc) return;
    if (
      !(await confirm({
        message: `Eliminare "${doc.filename}"? L'operazione non è reversibile.`,
        confirmLabel: "Elimina",
        danger: true,
      }))
    )
      return;

    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await deleteDocument(supabase, user.id, doc);
      router.push("/archive");
    } catch (err) {
      setError(errorMessage(err, "Impossibile eliminare il contenuto."));
      setBusy(false);
    }
  }

  return { busy, rereading, handleDownload, handleReread, handleDelete };
}
