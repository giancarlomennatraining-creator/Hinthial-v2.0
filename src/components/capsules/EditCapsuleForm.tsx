"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase/client";
import { listCapsules, updateCapsule } from "@/domain/capsules/repository";
import { listTrustedContacts } from "@/domain/contacts/repository";
import { listDocuments } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import { ContactPicker } from "@/components/capsules/ContactPicker";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import type { CapsuleAttachment, CapsuleListItem } from "@/domain/capsules/types";
import type { TrustedContactListItem } from "@/domain/contacts/types";
import type { DocumentListItem } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Step = 1 | 2 | 3;

const STEP_LABEL: Record<Step, string> = {
  1: "chi e quando",
  2: "contenuti dall'archivio",
  3: "audio, video e testo",
};

/**
 * Pagina dedicata alla modifica di una capsula --- prima era un form
 * inline nella riga di CapsulesPanel, ora una pagina a sé come la
 * creazione, con gli stessi tre passi di CreateCapsuleForm (chi e
 * quando -> contenuti dall'archivio -> audio, video e testo), non un
 * unico form lungo. Solo le capsule ancora in Bozza sono modificabili
 * (v. updateCapsule): chiudere una capsula la rende autosufficiente,
 * non più legata agli originali --- una volta chiusa non ha più senso
 * "modificarla" qui. Titolo, data di apertura, destinatari, contenuto
 * testuale, contenuti collegati dall'Archivio E allegati audio/video
 * diretti (registrati o caricati) sono tutti modificabili --- questi
 * ultimi con lo stesso registratore/upload della creazione (passo 3):
 * si può rimuovere un allegato esistente e/o aggiungerne di nuovi nello
 * stesso salvataggio.
 */
export function EditCapsuleForm({ masterKey, capsuleId }: { masterKey: CryptoKey; capsuleId: string }) {
  const supabase = useRef(createClient()).current;
  const router = useRouter();

  const [capsule, setCapsule] = useState<CapsuleListItem | null>(null);
  const [activeContacts, setActiveContacts] = useState<TrustedContactListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [relatedContacts, setRelatedContacts] = useState<TrustedContactListItem[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<DocumentListItem[]>([]);
  // Allegati diretti (audio/video) --- keptAttachments parte dagli
  // esistenti, "Rimuovi" li sposta in removedAttachments (cancellati da
  // Storage solo dopo il salvataggio riuscito, v. updateCapsule).
  // newFiles sono quelli aggiunti ora, registrati o caricati.
  const [keptAttachments, setKeptAttachments] = useState<CapsuleAttachment[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<CapsuleAttachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [capsules, contacts, categoriesResult, documentsResult] = await Promise.all([
        listCapsules(supabase, masterKey),
        listTrustedContacts(supabase, masterKey),
        listCategories(supabase),
        listDocuments(supabase, masterKey),
      ]);
      const found = capsules.find((c) => c.id === capsuleId) ?? null;
      setCapsule(found);
      setActiveContacts(contacts.filter((c) => c.status === "active"));
      setCategories(categoriesResult);
      setDocuments(documentsResult);
      if (found) {
        setTitle(found.title);
        setContent(found.content);
        setOpenAt(found.openAt ?? "");
        setRelatedContacts(found.relatedContacts);
        setLinkedDocuments(found.linkedDocuments);
        setKeptAttachments(found.attachments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare la capsula.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, capsuleId]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  function handleNextFromStep1() {
    if (!title.trim()) {
      setError("Il titolo della capsula non può essere vuoto.");
      return;
    }
    if (!openAt) {
      // Obbligatoria (Dead Man's Switch semplificato per le capsule) ---
      // anche una capsula creata prima che lo diventasse va sanata qui.
      setError("Scegli una data di apertura.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function removeExistingAttachment(attachment: CapsuleAttachment) {
    setKeptAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    setRemovedAttachments((prev) => [...prev, attachment]);
  }

  function handleMediaFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    // "accept" guida la scelta, ma non la impone davvero --- si scartano
    // in silenzio i file che non sono audio/video (stesso pattern di
    // CreateCapsuleForm).
    const picked = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith("audio/") || file.type.startsWith("video/"),
    );
    if (picked.length > 0) setNewFiles((prev) => [...prev, ...picked]);
    event.target.value = "";
  }

  async function handleSave() {
    if (!capsule) return;
    if (!title.trim()) {
      setError("Il titolo della capsula non può essere vuoto.");
      setStep(1);
      return;
    }
    if (!openAt) {
      // Obbligatoria (Dead Man's Switch semplificato per le capsule) ---
      // anche una capsula creata prima che lo diventasse va sanata qui.
      setError("Scegli una data di apertura.");
      setStep(1);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await updateCapsule(supabase, masterKey, user.id, capsuleId, keptAttachments, removedAttachments, {
        title: title.trim(),
        content: content.trim(),
        relatedContactIds: relatedContacts.map((c) => c.id),
        linkedDocumentIds: linkedDocuments.map((d) => d.id),
        newFiles,
        openAt,
      });
      router.push("/capsules?updated=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la capsula.");
      setSaving(false);
    }
  }

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
          Modifica capsula
        </h1>
        {!loading && capsule && capsule.status === "draft" ? (
          <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Passo {step} di 3 --- {STEP_LABEL[step]}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !capsule ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Capsula non trovata.
        </p>
      ) : capsule.status !== "draft" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Solo le capsule ancora in bozza sono modificabili --- questa è già stata chiusa.
        </p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
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
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="openAt" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Data di apertura
                  </label>
                  <input
                    id="openAt"
                    type="date"
                    required
                    value={openAt}
                    onChange={(e) => setOpenAt(e.target.value)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                  />
                </div>
              </div>

              <ContactPicker
                idPrefix="edit"
                contacts={activeContacts}
                selected={relatedContacts}
                onChange={setRelatedContacts}
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
                idPrefix="edit"
                categories={categories}
                documents={documents}
                selected={linkedDocuments}
                onChange={setLinkedDocuments}
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
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
                />
              </div>

              {/* Allegati diretti audio/video --- esistenti (rimovibili) + nuovi (registrati o caricati ora). */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Allegati audio/video</p>

                {keptAttachments.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {keptAttachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {CONTENT_KIND_ICON[contentKindFor(attachment.mimeType)]} {attachment.filename} ·{" "}
                        {formatSize(attachment.size)}
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(attachment)}
                          aria-label={`Rimuovi ${attachment.filename}`}
                          className="rounded-full px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-zinc-600">Nessuno.</p>
                )}

                <AudioVideoRecorder
                  onRecorded={(file) => setNewFiles((prev) => [...prev, file])}
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

                {newFiles.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {newFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                      >
                        {file.type.startsWith("video/") ? "🎥" : "🎤"} {file.name}
                        <button
                          type="button"
                          onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`Rimuovi ${file.name}`}
                          className="rounded-full px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

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
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="self-start rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {saving ? "Salvataggio…" : "Salva modifiche"}
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
        </div>
      )}
    </div>
  );
}
