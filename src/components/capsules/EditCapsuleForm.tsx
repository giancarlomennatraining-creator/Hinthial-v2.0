"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { listCapsules, updateCapsule } from "@/domain/capsules/repository";
import { listFriends } from "@/domain/friends/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import { FriendPicker } from "@/components/capsules/FriendPicker";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { CapsuleOpenAtField } from "@/components/capsules/CapsuleOpenAtField";
import { CapsuleLetterEditor } from "@/components/capsules/CapsuleLetterEditor";
import {
  AttachmentChip,
  AttachmentSection,
  CapsuleFormCard,
  CapsuleFormHeader,
  CapsuleTitleField,
  NewFileChips,
  StepError,
  StepNav,
  type CapsuleFormStep,
} from "@/components/capsules/capsule-form-parts";
import type { CapsuleAttachment, CapsuleContentStyle, CapsuleListItem } from "@/domain/capsules/types";
import type { FriendListItem } from "@/domain/friends/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import { BTN_PRIMARY } from "@/components/ui/styles";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pagina di modifica di una capsula, con gli stessi tre passi di CreateCapsuleForm. Solo le capsule ancora in Bozza
 * sono modificabili (v. updateCapsule): chiuderla la rende autosufficiente, non più legata agli originali. Allegati
 * audio/video esistenti sono rimovibili e nuovi aggiungibili nello stesso salvataggio.
 */
export function EditCapsuleForm({ masterKey, capsuleId }: { masterKey: CryptoKey; capsuleId: string }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [capsule, setCapsule] = useState<CapsuleListItem | null>(null);
  const [activeFriends, setActiveFriends] = useState<FriendListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<CapsuleFormStep>(1);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentStyle, setContentStyle] = useState<CapsuleContentStyle>("simple");
  const [openAt, setOpenAt] = useState("");
  const [showAttachmentTools, setShowAttachmentTools] = useState(false);
  const [relatedFriends, setRelatedFriends] = useState<FriendListItem[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<DocumentSummary[]>([]);
  // Allegati diretti: keptAttachments parte dagli esistenti, "Rimuovi" li sposta in removedAttachments (cancellati da Storage solo dopo il salvataggio, v. updateCapsule). newFiles sono quelli aggiunti ora.
  const [keptAttachments, setKeptAttachments] = useState<CapsuleAttachment[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<CapsuleAttachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // Contatore di richieste, non un booleano "cancelled": StrictMode invoca due volte l'effetto al mount, senza
  // questa guardia la prima fetch, se risolve dopo la seconda, sovrascriverebbe titolo/data già modificati.
  const latestRequestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setError(null);
    try {
      const [capsules, friends, categoriesResult, documentsResult, dossiersResult] =
        await Promise.all([
          listCapsules(supabase, masterKey),
          listFriends(supabase, masterKey),
          listCategories(supabase),
          listDocumentSummaries(supabase, masterKey),
          listDossiers(supabase, masterKey),
        ]);
      if (requestId !== latestRequestRef.current) return;
      const found = capsules.find((c) => c.id === capsuleId) ?? null;
      setCapsule(found);
      setActiveFriends(friends.filter((c) => c.status === "active"));
      setCategories(categoriesResult);
      setDocuments(documentsResult);
      setDossiers(dossiersResult);
      if (found) {
        setTitle(found.title);
        setContent(found.content);
        setContentStyle(found.contentStyle);
        setOpenAt(found.openAt ?? "");
        setRelatedFriends(found.relatedFriends);
        setLinkedDocuments(found.linkedDocuments);
        setKeptAttachments(found.attachments);
      }
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Impossibile caricare la capsula.");
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
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
      // Obbligatoria (Dead Man's Switch semplificato): anche una capsula creata prima va sanata qui.
      setError("Scegli data e ora di apertura.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function removeExistingAttachment(attachment: CapsuleAttachment) {
    setKeptAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    setRemovedAttachments((prev) => [...prev, attachment]);
  }

  async function handleSave() {
    if (!capsule) return;
    if (!title.trim()) {
      setError("Il titolo della capsula non può essere vuoto.");
      setStep(1);
      return;
    }
    if (!openAt) {
      // Obbligatoria (Dead Man's Switch semplificato): anche una capsula creata prima va sanata qui.
      setError("Scegli data e ora di apertura.");
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
        contentStyle,
        relatedFriendIds: relatedFriends.map((c) => c.id),
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
    <div className="flex flex-col gap-6">
      <CapsuleFormHeader
        title="Modifica capsula"
        step={!loading && capsule && capsule.status === "draft" ? step : null}
      />

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : !capsule ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Capsula non trovata.
        </p>
      ) : capsule.status !== "draft" ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Solo le capsule ancora in bozza sono modificabili — questa è già stata chiusa.
        </p>
      ) : (
        <CapsuleFormCard>
          {step === 1 ? (
            <>
              <CapsuleTitleField value={title} onChange={setTitle} />

              <FriendPicker
                idPrefix="edit"
                friends={activeFriends}
                selected={relatedFriends}
                onChange={setRelatedFriends}
              />

              <CapsuleOpenAtField id="openAt" value={openAt} onChange={setOpenAt} />

              <StepError error={error} />

              <StepNav>
                <button type="button" onClick={handleNextFromStep1} className={`self-start ${BTN_PRIMARY}`}>
                  Avanti
                </button>
              </StepNav>
            </>
          ) : step === 2 ? (
            <>
              <DocumentAttachmentPicker
                idPrefix="edit"
                categories={categories}
                documents={documents}
                dossiers={dossiers}
                selected={linkedDocuments}
                onChange={setLinkedDocuments}
              />

              <StepError error={error} />

              <StepNav onBack={() => setStep(1)}>
                <button type="button" onClick={() => setStep(3)} className={`self-start ${BTN_PRIMARY}`}>
                  Avanti
                </button>
              </StepNav>
            </>
          ) : (
            <>
              <CapsuleLetterEditor
                id="content"
                content={content}
                onContentChange={setContent}
                contentStyle={contentStyle}
                onContentStyleChange={setContentStyle}
              />

              {/* Allegati: esistenti (rimovibili) + nuovi. */}
              <AttachmentSection
                showTools={showAttachmentTools}
                onToggleTools={() => setShowAttachmentTools((v) => !v)}
                onAddFiles={(files) => setNewFiles((prev) => [...prev, ...files])}
                chips={
                  <>
                    {keptAttachments.map((attachment) => (
                      <AttachmentChip
                        key={attachment.id}
                        label={
                          <>
                            {CONTENT_KIND_ICON[contentKindFor(attachment.mimeType)]} {attachment.filename} ·{" "}
                            {formatSize(attachment.size)}
                          </>
                        }
                        name={attachment.filename}
                        onRemove={() => removeExistingAttachment(attachment)}
                      />
                    ))}
                    <NewFileChips
                      files={newFiles}
                      onRemove={(index) => setNewFiles((prev) => prev.filter((_, j) => j !== index))}
                    />
                  </>
                }
              />

              <StepError error={error} />

              <StepNav onBack={() => setStep(2)}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className={`self-start ${BTN_PRIMARY} disabled:opacity-50`}
                >
                  {saving ? "Salvataggio…" : "Salva modifiche"}
                </button>
              </StepNav>
            </>
          )}
        </CapsuleFormCard>
      )}
    </div>
  );
}
