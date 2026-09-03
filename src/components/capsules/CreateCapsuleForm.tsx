"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { createCapsule } from "@/domain/capsules/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { ContactPicker } from "@/components/capsules/ContactPicker";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

type Step = 1 | 2 | 3;

const STEP_LABEL: Record<Step, string> = {
  1: "chi e quando",
  2: "contenuti dall'archivio",
  3: "audio, video e testo",
};

/**
 * Pagina dedicata alla creazione di una capsula (estratta da
 * CapsulesPanel, che ora mostra solo l'elenco più un tasto "Crea
 * capsula"). Wizard a tre passi (FASE 14): passo 1 chi/quando (titolo,
 * data di apertura, destinatari), passo 2 elementi già presenti in
 * Archivio da collegare, passo 3 contenuto scritto e audio/video
 * registrati o caricati sul momento --- questi ultimi restano privati
 * della capsula, mai copiati in Archivio: sono pensati come un
 * messaggio personale per quel destinatario, non un contenuto
 * d'archivio generale. Alla creazione riuscita torna a /capsules con
 * un messaggio di conferma --- passato come semplice flag nell'URL
 * (`?created=1`), mai il titolo o altro contenuto della capsula:
 * finirebbe in chiaro nella cronologia del browser, in contrasto con
 * lo zero-knowledge.
 */
export function CreateCapsuleForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [contacts, setContacts] = useState<TrustedContactListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [pendingRelatedContacts, setPendingRelatedContacts] = useState<TrustedContactListItem[]>(
    [],
  );

  const [content, setContent] = useState("");
  const [pendingLinkedDocuments, setPendingLinkedDocuments] = useState<DocumentListItem[]>([]);
  const [recordedFiles, setRecordedFiles] = useState<File[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [contactsResult, categoriesResult, documentsResult] = await Promise.all([
        listTrustedContacts(supabase, masterKey),
        listCategories(supabase),
        listDocuments(supabase, masterKey),
      ]);
      setContacts(contactsResult);
      setCategories(categoriesResult);
      setDocuments(documentsResult);
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

  function handleNextFromStep1() {
    if (!title.trim()) {
      setError("Inserisci almeno un titolo.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function handleMediaFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    // "accept" guida la scelta, ma non la impone davvero (drag&drop,
    // selezione manuale, ...) --- si scartano in silenzio i file che
    // non sono audio/video, coerentemente con l'intento del campo.
    const picked = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith("audio/") || file.type.startsWith("video/"),
    );
    if (picked.length > 0) setRecordedFiles((prev) => [...prev, ...picked]);
    event.target.value = "";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Inserisci almeno un titolo.");
      setStep(1);
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await createCapsule(supabase, masterKey, user.id, {
        title: title.trim(),
        content: content.trim(),
        relatedContactIds: pendingRelatedContacts.map((c) => c.id),
        files: recordedFiles,
        linkedDocumentIds: pendingLinkedDocuments.map((d) => d.id),
        openAt: openAt || null,
      });
      router.push("/capsules?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la capsula.");
      setCreating(false);
    }
  }

  // Solo contatti fiduciari ATTIVI possono essere scelti come destinatario.
  const activeContacts = contacts.filter((c) => c.status === "active");

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/capsules"
          className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
        >
          ← Torna alle capsule
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Nuova capsula
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Contenuti cifrati da lasciare a uno o più destinatari, in condizioni definite da te.
        </p>
        <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Passo {step} di 3 --- {STEP_LABEL[step]}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          {step === 1 ? (
            <>
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-1 min-w-[10rem] flex-col gap-1">
                  <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Titolo
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="es. Per Maria"
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="openAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Data di apertura (facoltativa)
                  </label>
                  <input
                    id="openAt"
                    type="date"
                    value={openAt}
                    onChange={(e) => setOpenAt(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>

              <ContactPicker
                idPrefix="create"
                contacts={activeContacts}
                selected={pendingRelatedContacts}
                onChange={setPendingRelatedContacts}
              />

              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleNextFromStep1}
                  className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  Avanti
                </button>
                <Link
                  href="/capsules"
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Annulla
                </Link>
              </div>
            </>
          ) : step === 2 ? (
            <>
              <DocumentAttachmentPicker
                idPrefix="create"
                categories={categories}
                documents={documents}
                selected={pendingLinkedDocuments}
                onChange={setPendingLinkedDocuments}
              />

              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Indietro
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  Avanti
                </button>
                <Link
                  href="/capsules"
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Annulla
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="content" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Contenuto
                </label>
                <textarea
                  id="content"
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cosa vuoi lasciare scritto..."
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>

              <AudioVideoRecorder
                onRecorded={(file) => setRecordedFiles((prev) => [...prev, file])}
                confirmLabel="Aggiungi alla capsula"
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="mediaFiles" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  ...o carica un audio/video già pronto (opzionale)
                </label>
                <input
                  id="mediaFiles"
                  type="file"
                  accept="audio/*,video/*"
                  multiple
                  onChange={handleMediaFileChange}
                  className="text-sm text-zinc-700 dark:text-zinc-300"
                />
              </div>

              {recordedFiles.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {recordedFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                    >
                      {file.type.startsWith("video/") ? "🎥" : "🎤"} {file.name}
                      <button
                        type="button"
                        onClick={() => setRecordedFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Rimuovi ${file.name}`}
                        className="rounded-full px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Indietro
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {creating ? "Creazione…" : "Crea capsula"}
                </button>
                <Link
                  href="/capsules"
                  className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Annulla
                </Link>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
