"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { mimeTypeOfFile } from "@/lib/file-mime";
import { listDocumentSummaries, type PriorExtraction } from "@/domain/documents/repository";
import { canExtractText, extractContent } from "@/domain/extraction/extract-text";
import { detectDuplicates } from "@/domain/bulk-import/duplicates";
import { groupByFilename } from "@/domain/bulk-import/grouping";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { LotFile } from "@/components/documents/create/create-model";

/**
 * I file scelti (uno o molti, stesso percorso): la lettura di ognuno sul dispositivo, i doppioni, i raggruppamenti
 * che suggeriscono un fascicolo. `title` è il titolo unico di quando il file è uno solo: passando da uno a più file
 * o viceversa si sposta tra il campo unico e le righe del lotto.
 */
export function useFileLot(
  masterKey: CryptoKey,
  dossiers: DossierListItem[],
  title: string,
  setTitle: (title: string) => void,
  setError: (message: string | null) => void,
) {
  const supabase = useSupabase();

  const fileInputRef = useRef<HTMLInputElement>(null);
  // I file scelti: uno o molti, stesso percorso (v. addFiles). Ognuno si legge sul dispositivo appena scelto.
  const [lot, setLot] = useState<LotFile[]>([]);
  // FASE 17b/17c: la percentuale distingue un'attesa lunga da un blocco (anche durante il salvataggio, v. useCreateSubmit).
  const [readProgress, setReadProgress] = useState<number | null>(null);

  // FASE 19b: la lettura parte appena scegli i file, non a Salva --- avviene dentro il tempo che stavi già spendendo. Uno
  // alla volta, non in parallelo: dieci file insieme su un telefono, alcuni con OCR, lo farebbero solo arrancare.
  const readQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  // La lettura di ogni file, per poterla aspettare al salvataggio se non ha ancora finito (v. uploadLot).
  const readPromisesRef = useRef(new Map<string, Promise<PriorExtraction>>());
  // La zona resta visibile mentre i file si leggono e un istante dopo (il timbro "Fatto"), poi lascia il posto alla scheda dei file.
  const [zoneSettled, setZoneSettled] = useState(false);
  const lotReading = lot.some((l) => l.reading.status === "idle" || l.reading.status === "reading");
  const zoneState: "idle" | "loading" | "done" = lot.length === 0 ? "idle" : lotReading ? "loading" : "done";
  const zoneProgress = (() => {
    const current = lot.find((l) => l.reading.status === "reading");
    const currentProgress = current && current.reading.status === "reading" ? current.reading.progress : null;
    if (lot.length === 1) return currentProgress;
    const finished = lot.filter((l) => l.reading.status === "done" || l.reading.status === "skipped").length;
    return lotReading ? (finished + (currentProgress ?? 0)) / lot.length : null;
  })();
  useEffect(() => {
    if (lot.length === 0 || zoneState !== "done" || zoneSettled) return;
    const timer = setTimeout(() => setZoneSettled(true), 1100);
    return () => clearTimeout(timer);
  }, [lot.length, zoneState, zoneSettled]);

  // Cosa c'è già in Archivio, per riconoscere i doppioni e i fascicoli a cui un file sembra appartenere. Si legge una volta,
  // alla prima scelta di un file: partire senza file non deve costare nulla.
  const [existingDocuments, setExistingDocuments] = useState<Pick<DocumentSummary, "filename" | "size" | "createdAt" | "dossierIds">[]>([]);
  const existingRequestedRef = useRef(false);
  useEffect(() => {
    if (lot.length === 0 || existingRequestedRef.current) return;
    existingRequestedRef.current = true;
    listDocumentSummaries(supabase, masterKey)
      .then(setExistingDocuments)
      .catch(() => {
        // Senza, il file si carica lo stesso: solo non si avvisa dei doppioni.
      });
  }, [lot.length, supabase, masterKey]);
  const duplicates = useMemo(() => detectDuplicates(lot, existingDocuments), [lot, existingDocuments]);
  const groups = useMemo(() => groupByFilename(lot, existingDocuments, dossiers), [lot, existingDocuments, dossiers]);
  // Le proposte di fascicolo: i gruppi con un fascicolo esistente o uno nuovo da creare (v. domain/bulk-import/grouping.ts).
  const proposedGroups = groups.filter((g) => g.label !== null && (g.existingDossier || g.proposedDossierTitle));

  /** Svuota il lotto (cambiando modo non si porta dietro i file del modo di prima). */
  function resetLot() {
    setLot([]);
    readPromisesRef.current.clear();
    setZoneSettled(false);
  }

  function updateLotFile(id: string, patch: Partial<Pick<LotFile, "title" | "reading">>) {
    setLot((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /** Aggiunge file al lotto (uno o molti) e ne avvia la lettura, dopo quelli già in coda. */
  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setZoneSettled(false);
    const added: LotFile[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      title: "",
      reading: { status: "idle" },
    }));
    // Passando da uno a più file il titolo scritto finora resta al primo, non si perde.
    setLot((prev) => {
      const next = prev.length === 1 && title ? prev.map((item) => ({ ...item, title })) : prev;
      return [...next, ...added];
    });
    if (lot.length === 1 && title) setTitle("");
    // Non si azzerano categoria/bene/fascicoli/note: ciò che è già compilato non si tocca.
    for (const item of added) {
      const promise = readQueueRef.current.then(() => readLotFile(item));
      readQueueRef.current = promise;
      readPromisesRef.current.set(item.id, promise);
    }
  }

  /** Toglie un file dal lotto (anche un doppione che non vale la pena riportare dentro). */
  function removeFile(id: string) {
    readPromisesRef.current.delete(id);
    const remaining = lot.filter((item) => item.id !== id);
    setLot(remaining);
    // Tornando a un file solo, il suo titolo torna nel campo unico.
    if (remaining.length === 1) setTitle(remaining[0].title);
    if (remaining.length <= 1) setZoneSettled(remaining.length === 1);
    if (remaining.length === 0) {
      setTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Legge il testo del file sul dispositivo, per salvarlo con il contenuto (ricerca, analisi di Silva). Non compila nessun campo. */
  async function readLotFile({ id, file }: LotFile): Promise<PriorExtraction> {
    const mimeType = mimeTypeOfFile(file);

    if (!canExtractText(mimeType)) {
      updateLotFile(id, { reading: { status: "skipped" } });
      return { text: null, attempted: false };
    }

    updateLotFile(id, { reading: { status: "reading", progress: null } });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const content = await extractContent(bytes, mimeType, (progress) => {
        updateLotFile(id, { reading: { status: "reading", progress } });
        setReadProgress(progress);
      });
      const text = content?.text ?? null;
      updateLotFile(id, { reading: { status: "done", text } });
      return { text, segments: content?.segments, attempted: true };
    } catch {
      // Leggere è un di più: un file illeggibile non deve impedire di salvarlo.
      updateLotFile(id, { reading: { status: "done", text: null } });
      return { text: null, attempted: false };
    }
  }

  // "📷 Scatta foto" riusa la stessa casella file con `capture` impostato un istante prima (ignorato sui dispositivi che non lo supportano) --- un solo <input type="file"> nel DOM.
  function handleCameraClick() {
    const input = fileInputRef.current;
    if (!input) return;
    input.setAttribute("accept", "image/*");
    input.setAttribute("capture", "environment");
    input.click();
  }

  // Ripristina la casella al comportamento normale --- altrimenti un click diretto continuerebbe ad aprire solo la fotocamera.
  function handleFileInputBlur(event: React.FocusEvent<HTMLInputElement>) {
    event.target.removeAttribute("accept");
    event.target.removeAttribute("capture");
  }

  return {
    fileInputRef,
    lot,
    readProgress,
    setReadProgress,
    readPromisesRef,
    zoneSettled,
    zoneState,
    zoneProgress,
    duplicates,
    proposedGroups,
    resetLot,
    updateLotFile,
    addFiles,
    removeFile,
    handleCameraClick,
    handleFileInputBlur,
  };
}

export type FileLot = ReturnType<typeof useFileLot>;
