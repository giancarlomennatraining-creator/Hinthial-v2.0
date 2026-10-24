"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { deleteDossier, setDossierStatus } from "@/domain/dossiers/repository";
import { createTextNote } from "@/domain/documents/repository";
import { useToast } from "@/components/ui/ToastProvider";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { errorMessage } from "@/lib/utils";
import type { DossierData } from "@/components/dossiers/detail/useDossierData";

/** Le azioni sul fascicolo intero (aprire/chiudere, eliminare) e le note, che nascono qui come note dell'Archivio. */
export function useDossierActions(masterKey: CryptoKey, dossierId: string, data: DossierData) {
  const supabase = useSupabase();
  const confirm = useConfirm();
  const router = useRouter();
  const showToast = useToast();
  const { dossier, refresh, setError } = data;

  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  async function handleToggleStatus() {
    if (!dossier) return;
    setBusy(true);
    setError(null);
    try {
      const next = dossier.status === "open" ? "closed" : "open";
      await setDossierStatus(supabase, dossierId, next);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Impossibile aggiornare lo stato."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!dossier) return;
    if (
      !(await confirm({
        message: `Eliminare il fascicolo "${dossier.title}"? I documenti collegati non verranno eliminati, solo scollegati.`,
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
      await deleteDossier(supabase, user.id, dossierId);
      router.push("/dossiers?deleted=1");
    } catch (err) {
      setError(errorMessage(err, "Impossibile eliminare il fascicolo."));
      setBusy(false);
    }
  }

  /** Una nota è una nota dell'Archivio collegata al fascicolo: niente di nuovo da gestire, e si ritrova anche in Archivio. */
  async function handleAddNote() {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      const title = text.split("\n")[0].slice(0, 60);
      await createTextNote(supabase, masterKey, user.id, { title, body: text }, {
        categoryId: null,
        relatedAssetId: null,
        dossierIds: [dossierId],
        expiresAt: null,
        notes: "",
        issuer: "",
      });
      setNoteText("");
      await refresh();
      showToast("Nota aggiunta.");
    } catch (err) {
      setError(errorMessage(err, "Impossibile aggiungere la nota."));
    } finally {
      setNoteBusy(false);
    }
  }

  return { busy, noteText, setNoteText, noteBusy, handleToggleStatus, handleDelete, handleAddNote };
}
