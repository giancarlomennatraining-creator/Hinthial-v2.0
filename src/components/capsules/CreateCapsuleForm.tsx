"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { createCapsule } from "@/domain/capsules/repository";
import { listFriends } from "@/domain/friends/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { FriendPicker } from "@/components/capsules/FriendPicker";
import { CapsuleOpenAtField } from "@/components/capsules/CapsuleOpenAtField";
import { CapsuleLetterEditor } from "@/components/capsules/CapsuleLetterEditor";
import {
  AttachmentSection,
  CapsuleFormCard,
  CapsuleFormHeader,
  CapsuleTitleField,
  NewFileChips,
  StepError,
  StepNav,
  type CapsuleFormStep,
} from "@/components/capsules/capsule-form-parts";
import type { FriendListItem } from "@/domain/friends/types";
import type { DocumentSummary } from "@/domain/documents/types";
import type { Category } from "@/domain/categories/types";
import type { DossierListItem } from "@/domain/dossiers/types";
import type { CapsuleContentStyle } from "@/domain/capsules/types";
import { BTN_PRIMARY } from "@/components/ui/styles";

/**
 * Wizard a tre passi: chi/quando (titolo, data e ora di apertura, destinatari), elementi già in Archivio da
 * collegare, contenuto scritto e audio/video registrati o caricati sul momento --- questi ultimi restano privati
 * della capsula, mai copiati in Archivio. Alla creazione torna a /capsules con `?created=1`, mai il titolo o altro
 * contenuto della capsula, che finirebbe in chiaro nella cronologia del browser.
 */
export function CreateCapsuleForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [dossiers, setDossiers] = useState<DossierListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [step, setStep] = useState<CapsuleFormStep>(1);
  const [title, setTitle] = useState("");
  const [openAt, setOpenAt] = useState("");
  const [pendingRelatedFriends, setPendingRelatedFriends] = useState<FriendListItem[]>([]);

  const [content, setContent] = useState("");
  const [contentStyle, setContentStyle] = useState<CapsuleContentStyle>("simple");
  const [showAttachmentTools, setShowAttachmentTools] = useState(false);
  const [pendingLinkedDocuments, setPendingLinkedDocuments] = useState<DocumentSummary[]>([]);
  const [recordedFiles, setRecordedFiles] = useState<File[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [friendsResult, categoriesResult, documentsResult, dossiersResult] =
        await Promise.all([
          listFriends(supabase, masterKey),
          listCategories(supabase),
          listDocumentSummaries(supabase, masterKey),
          listDossiers(supabase, masterKey),
        ]);
      setFriends(friendsResult);
      setCategories(categoriesResult);
      setDocuments(documentsResult);
      setDossiers(dossiersResult);
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
    if (!openAt) {
      // Obbligatoria: raggiunta questa data, il destinatario può vederne il contenuto.
      setError("Scegli data e ora di apertura.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim() || !openAt) {
      setError(!title.trim() ? "Inserisci almeno un titolo." : "Scegli data e ora di apertura.");
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
        contentStyle,
        relatedFriendIds: pendingRelatedFriends.map((c) => c.id),
        files: recordedFiles,
        linkedDocumentIds: pendingLinkedDocuments.map((d) => d.id),
        openAt,
      });
      router.push("/capsules?created=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile creare la capsula.");
      setCreating(false);
    }
  }

  // Solo amici ATTIVI possono essere scelti come destinatario.
  const activeFriends = friends.filter((c) => c.status === "active");

  return (
    <div className="flex flex-col gap-6">
      <CapsuleFormHeader
        title="Nuova capsula"
        description="Contenuti cifrati da lasciare a uno o più destinatari, in condizioni definite da te."
        step={step}
      />

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <CapsuleFormCard onSubmit={handleCreate}>
          {step === 1 ? (
            <>
              <CapsuleTitleField value={title} onChange={setTitle} placeholder="es. Per Maria" />

              <FriendPicker
                idPrefix="create"
                friends={activeFriends}
                selected={pendingRelatedFriends}
                onChange={setPendingRelatedFriends}
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
                idPrefix="create"
                categories={categories}
                documents={documents}
                dossiers={dossiers}
                selected={pendingLinkedDocuments}
                onChange={setPendingLinkedDocuments}
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
                placeholder="Cosa vuoi lasciare scritto..."
              />

              <AttachmentSection
                showTools={showAttachmentTools}
                onToggleTools={() => setShowAttachmentTools((v) => !v)}
                onAddFiles={(files) => setRecordedFiles((prev) => [...prev, ...files])}
                chips={
                  <NewFileChips
                    files={recordedFiles}
                    onRemove={(index) => setRecordedFiles((prev) => prev.filter((_, j) => j !== index))}
                  />
                }
              />

              <StepError error={error} />

              <StepNav onBack={() => setStep(2)}>
                <button type="submit" disabled={creating} className={`self-start ${BTN_PRIMARY} disabled:opacity-50`}>
                  {creating ? "Creazione…" : "Crea capsula"}
                </button>
              </StepNav>
            </>
          )}
        </CapsuleFormCard>
      )}
    </div>
  );
}
