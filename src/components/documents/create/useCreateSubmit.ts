"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  createTextNote,
  getDocumentById,
  uploadDocument,
  type UploadPhase,
} from "@/domain/documents/repository";
import { createDossier } from "@/domain/dossiers/repository";
import { addPendingConfirmation } from "@/domain/documents/pending-confirmation";
import { useToast } from "@/components/ui/ToastProvider";
import type { DocumentMetadataFieldsValue } from "@/components/documents/DocumentMetadataFields";
import type {
  DocumentListItem,
  DocumentMetadataInput,
} from "@/domain/documents/types";
import {
  recordingTitle,
  type CreationMode,
} from "@/components/documents/create/create-model";
import type { FileLot } from "@/components/documents/create/useFileLot";

/** Per gruppo di file (per nome): se collegarlo a un fascicolo, e con che titolo se nuovo. */
export type GroupChoices = Record<string, { link: boolean; title: string }>;

/** Ciò che il salvataggio legge dal form: il modo scelto, i dettagli, il contenuto (file, registrazione o nota) e le scelte sui fascicoli proposti. */
interface SubmitInput {
  mode: CreationMode | null;
  metadata: DocumentMetadataFieldsValue;
  fileLot: FileLot;
  title: string;
  recordedFile: File | null;
  noteTitle: string;
  noteBody: string;
  groupChoices: GroupChoices;
  alreadySaved: boolean;
  setError: (message: string | null) => void;
  /** Il contenuto è salvato e riletto: si passa ai passi su cosa farne (v. usePostSave). */
  onSaved: (created: DocumentListItem) => void;
}

/**
 * Il salvataggio: il contenuto, uno o più file (con i fascicoli proposti) o una nota o una registrazione. Dopo, i
 * passi di cosa succede dopo (Concept D) per un contenuto solo, la conferma dell'importazione per i file.
 */
export function useCreateSubmit(masterKey: CryptoKey, input: SubmitInput) {
  const supabase = useSupabase();
  const router = useRouter();
  const showToast = useToast();
  const { mode, metadata, fileLot, title, recordedFile, noteTitle, noteBody, groupChoices, alreadySaved, setError, onSaved } = input;
  const { lot, proposedGroups, readPromisesRef, setReadProgress } = fileLot;

  const [creating, setCreating] = useState(false);
  // FASE 17b/17c: dice "sto leggendo" invece di "Salvataggio…" mentre legge.
  const [phase, setPhase] = useState<UploadPhase>("saving");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  /**
   * Salva tutti i file del lotto, uno dopo l'altro, con gli stessi dettagli. Un fascicolo proposto (v. proposedGroups) si
   * crea una volta per gruppo, non per file: dieci bollette non devono finire in dieci fascicoli. Con un file solo un errore
   * si mostra e si ferma; con più file un file che non si riesce a salvare non ferma gli altri, si conta e si prosegue.
   */
  async function uploadLot(userId: string, metadataInput: DocumentMetadataInput) {
    const strict = lot.length === 1;
    const dossierByFile = new Map<string, string>();
    let dossiersCreated = 0;
    for (const group of proposedGroups) {
      const key = group.label as string;
      const choice = groupChoices[key];
      if (choice && !choice.link) continue;
      let dossierId = group.existingDossier?.id ?? null;
      if (!dossierId && group.proposedDossierTitle) {
        const dossierTitle = choice?.title.trim() || group.proposedDossierTitle;
        try {
          dossierId = await createDossier(supabase, masterKey, userId, { title: dossierTitle, description: "" });
          dossiersCreated++;
        } catch {
          dossierId = null; // il fascicolo non nasce, ma i file si salvano comunque.
        }
      }
      if (dossierId) for (const f of group.files) dossierByFile.set(f.id, dossierId);
    }

    const ids: string[] = [];
    let failures = 0;
    setBatchProgress({ done: 0, total: lot.length });
    for (const [index, item] of lot.entries()) {
      const groupDossier = dossierByFile.get(item.id);
      const itemInput: DocumentMetadataInput = {
        ...metadataInput,
        dossierIds:
          groupDossier && !metadataInput.dossierIds.includes(groupDossier)
            ? [...metadataInput.dossierIds, groupDossier]
            : metadataInput.dossierIds,
      };
      try {
        // Se la lettura non ha ancora finito si aspetta (era già in corso dalla scelta del file), altrimenti il documento nascerebbe non cercabile.
        if (strict && item.reading.status === "reading") setPhase("reading");
        const extraction = (await readPromisesRef.current.get(item.id)) ?? { text: null, attempted: false };
        ids.push(
          await uploadDocument(supabase, masterKey, userId, item.file, itemInput, {
            title: strict ? title : item.title || undefined,
            extraction,
            onPhase: strict
              ? (nextPhase, progress) => {
                  setPhase(nextPhase);
                  setReadProgress(progress);
                }
              : undefined,
          }),
        );
      } catch (err) {
        if (strict) throw err;
        failures++;
      }
      setBatchProgress({ done: index + 1, total: lot.length });
    }
    return { ids, failures, dossiersCreated };
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (alreadySaved) return;
    setError(null);

    if (mode === "note" && !noteTitle.trim()) {
      setError("Inserisci un titolo per la nota.");
      return;
    }
    if (mode === "upload" && lot.length === 0) {
      setError("Scegli un file da caricare.");
      return;
    }
    if (mode === "record" && !recordedFile) {
      setError("Registra un audio o un video prima di continuare.");
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const metadataInput: DocumentMetadataInput = {
        categoryId: metadata.categoryId || null,
        relatedAssetId: metadata.relatedAssetId || null,
        dossierIds: metadata.dossierIds,
        expiresAt: metadata.expiresAt || null,
        notes: metadata.notes,
        issuer: metadata.issuer,
      };

      let newId: string;
      if (mode === "note") {
        newId = await createTextNote(
          supabase,
          masterKey,
          user.id,
          { title: noteTitle.trim(), body: noteBody },
          metadataInput,
        );
      } else if (mode === "upload") {
        const result = await uploadLot(user.id, metadataInput);
        if (result.ids.length === 0) throw new Error("Nessun file è stato importato.");
        // Uno o molti, dopo il salvataggio si va alla conferma (v. ConfirmImport): lettura di Hinthia, proposte, dettagli.
        showToast(
          lot.length === 1
            ? "Documento aggiunto."
            : result.failures === 0
              ? `${result.ids.length} contenuti importati${result.dossiersCreated > 0 ? `, ${result.dossiersCreated} nuovo fascicolo` : ""}.`
              : `${result.ids.length} importati, ${result.failures} non riusciti.`,
        );
        // Si ricordano da confermare su questo dispositivo, per riaprire la conferma da Archivio se la si chiude a metà.
        addPendingConfirmation(user.id, result.ids);
        router.push(`/archive/confirm?ids=${result.ids.join(",")}`);
        return;
      } else {
        const file = recordedFile!;
        newId = await uploadDocument(
          supabase,
          masterKey,
          user.id,
          file,
          metadataInput,
          {
            title: recordingTitle(title, file.name),
            // Il file registrato non passa dalla lettura del form: lo legge uploadDocument come sempre.
            onPhase: (nextPhase, progress) => {
              setPhase(nextPhase);
              setReadProgress(progress);
            },
          },
        );
      }

      // Invece del ritorno diretto a /archive, i passi 4 e 5 (cosa Hinthial ne ha già ricavato e, se vuoi,
      // l'analisi con Claude) --- prima di scegliere se andare sulla scheda o tornare all'archivio.
      const created = await getDocumentById(supabase, masterKey, newId);
      if (created) {
        onSaved(created);
      } else {
        // Non dovrebbe succedere, ma senza il documento non c'è niente da mostrare nei passi.
        router.push("/archive?created=1");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossibile aggiungere il contenuto.",
      );
      setCreating(false);
    }
  }

  return { creating, phase, batchProgress, handleCreate };
}
