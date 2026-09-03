"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createTextNote, uploadDocument } from "@/domain/documents/repository";
import { listAssets } from "@/domain/assets/repository";
import { listCategories } from "@/domain/categories/repository";
import { heuristicCategorizer } from "@/domain/categorizer/heuristic-provider";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import {
  DocumentMetadataFields,
  EMPTY_METADATA_FIELDS,
  parseTagsInput,
  type DocumentMetadataFieldsValue,
} from "@/components/documents/DocumentMetadataFields";
import type { Category } from "@/domain/categories/types";
import type { AssetListItem } from "@/domain/assets/types";
import type { DocumentMetadataInput } from "@/domain/documents/types";

type CreationMode = "upload" | "record" | "note";

const MODE_LABEL: Record<CreationMode, string> = {
  upload: "Carica un file",
  record: "Registra audio/video",
  note: "Scrivi una nota",
};

/**
 * Pagina dedicata alla creazione di un elemento d'Archivio (estratta da
 * DocumentsPanel, che ora mostra solo l'elenco più un tasto "+ Aggiungi
 * contenuto") --- un unico form per i tre modi di aggiungere qualcosa:
 * caricare un file già pronto, registrarne uno sul momento, o scrivere
 * una nota testuale (v. domain/documents/repository.ts, createTextNote).
 * Categoria/asset/scadenza/tag/note restano gli stessi a prescindere dal
 * tipo. Stesso pattern usato per capsule/asset/scadenze/contatti: alla
 * creazione riuscita torna a /archive con un messaggio di conferma
 * passato come flag nell'URL (`?created=1`).
 */
export function CreateArchiveItemForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [mode, setMode] = useState<CreationMode>("upload");
  const [metadata, setMetadata] = useState<DocumentMetadataFieldsValue>(EMPTY_METADATA_FIELDS);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [categoriesResult, assetsResult] = await Promise.all([
        listCategories(supabase),
        listAssets(supabase, masterKey),
      ]);
      setCategories(categoriesResult);
      setAssets(assetsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i dati necessari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function handleModeChange(next: CreationMode) {
    setMode(next);
    setPickedFile(null);
    setRecordedFile(null);
    setError(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPickedFile(file);
    // Stesso suggerimento automatico usato in DocumentsPanel --- mai
    // imposto, solo un default già riempito se non è già stata scelta
    // una categoria.
    if (file && !metadata.categoryId) {
      const suggestion = heuristicCategorizer.suggestCategory(file.name, categories);
      if (suggestion) setMetadata((prev) => ({ ...prev, categoryId: suggestion }));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "note" && !noteTitle.trim()) {
      setError("Inserisci un titolo per la nota.");
      return;
    }
    if (mode === "upload" && !pickedFile) {
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
        expiresAt: metadata.expiresAt || null,
        notes: metadata.notes,
        tags: parseTagsInput(metadata.tagsInput),
      };

      if (mode === "note") {
        await createTextNote(
          supabase,
          masterKey,
          user.id,
          { title: noteTitle.trim(), body: noteBody },
          metadataInput,
        );
      } else {
        const file = mode === "record" ? recordedFile! : pickedFile!;
        await uploadDocument(supabase, masterKey, user.id, file, metadataInput);
      }

      router.push("/archive?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiungere il contenuto.");
      setCreating(false);
    }
  }

  const canSubmit =
    (mode === "upload" && pickedFile) ||
    (mode === "record" && recordedFile) ||
    (mode === "note" && noteTitle.trim());

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
          Nuovo contenuto
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Documenti, immagini, audio, video o una nota scritta al momento --- tutto cifrato sul
          tuo dispositivo prima di essere salvato.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div role="radiogroup" aria-label="Tipo di contenuto" className="flex flex-wrap gap-2">
            {(Object.keys(MODE_LABEL) as CreationMode[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => handleModeChange(option)}
                className={
                  mode === option
                    ? "rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                }
              >
                {MODE_LABEL[option]}
              </button>
            ))}
          </div>

          {mode === "upload" ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="file" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                File
              </label>
              <input
                id="file"
                type="file"
                onChange={handleFileChange}
                className="text-sm text-zinc-700 dark:text-zinc-300"
              />
            </div>
          ) : mode === "record" ? (
            <AudioVideoRecorder
              onRecorded={setRecordedFile}
              title="Registra un audio o un video"
              description="Resta in memoria finché non salvi il contenuto qui sotto."
              confirmLabel="Usa questa registrazione"
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="note-title"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Titolo
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="es. Combinazione della cassaforte"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="note-body"
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
                >
                  Testo
                </label>
                <textarea
                  id="note-body"
                  rows={6}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>
            </div>
          )}

          {mode === "record" && recordedFile ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              🎬 Pronta: {recordedFile.name}
            </p>
          ) : null}

          <DocumentMetadataFields
            idPrefix="upload"
            categories={categories}
            assets={assets}
            value={metadata}
            onChange={setMetadata}
            showExpiry={false}
          />

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating || !canSubmit}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {creating ? "Salvataggio…" : "Aggiungi all'archivio"}
            </button>
            <Link
              href="/archive"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Annulla
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
