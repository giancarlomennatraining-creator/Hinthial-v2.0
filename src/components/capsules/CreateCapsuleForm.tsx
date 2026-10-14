"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { createCapsule } from "@/domain/capsules/repository";
import { listAssets } from "@/domain/assets/repository";
import { listFriends } from "@/domain/friends/repository";
import { listDocumentSummaries } from "@/domain/documents/repository";
import { listCategories } from "@/domain/categories/repository";
import { listDossiers } from "@/domain/dossiers/repository";
import { DocumentAttachmentPicker } from "@/components/capsules/DocumentAttachmentPicker";
import { FriendPicker } from "@/components/capsules/FriendPicker";
import { CapsuleLegacyField } from "@/components/capsules/CapsuleLegacyField";
import { CapsuleOpenAtField } from "@/components/capsules/CapsuleOpenAtField";
import { CapsuleLetterEditor } from "@/components/capsules/CapsuleLetterEditor";
import { CapsuleTemplatePicker } from "@/components/capsules/CapsuleTemplatePicker";
import { CapsuleOpenEffectPicker, previewAttachments } from "@/components/capsules/CapsuleOpenEffectPicker";
import { DEFAULT_OPEN_EFFECT, type CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import { getCapsuleAppearance } from "@/domain/profile/repository";
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
import { buildCapsuleStarter, parseStarter } from "@/domain/capsules/starter";
import { promptsFor, suggestedOpenAt, type CapsuleTemplate } from "@/domain/capsules/templates";
import { BTN_PRIMARY } from "@/components/ui/styles";

/**
 * Wizard a tre passi: chi/quando (titolo, data e ora di apertura, destinatari, e in cima un modello da cui partire), elementi già in Archivio da
 * collegare, contenuto scritto e audio/video registrati o caricati sul momento --- questi ultimi restano privati
 * della capsula, mai copiati in Archivio. Alla creazione torna a /capsules con `?created=1`, mai il titolo o altro
 * contenuto della capsula, che finirebbe in chiaro nella cronologia del browser.
 */
export function CreateCapsuleForm({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  // "Fallo arrivare a…": tipo e id di ciò da cui si parte (v. domain/capsules/starter.ts), mai testo nell'indirizzo.
  const starterParam = searchParams.get("da");
  const [starterOrigin, setStarterOrigin] = useState<string | null>(null);

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
  const [openOnLegacy, setOpenOnLegacy] = useState(false);
  // Un modello compila titolo e data solo finché non li ha toccati chi scrive: mai sovrascrivere una scelta fatta a mano.
  const [template, setTemplate] = useState<CapsuleTemplate | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  // L'effetto di apertura parte da quello preferito in Impostazioni > Aspetto > Capsule, finché chi scrive non ne sceglie un altro.
  const [openEffect, setOpenEffect] = useState<CapsuleOpenEffect>(DEFAULT_OPEN_EFFECT);
  const [effectTouched, setEffectTouched] = useState(false);
  const [openAtTouched, setOpenAtTouched] = useState(false);
  const [pendingRelatedFriends, setPendingRelatedFriends] = useState<FriendListItem[]>([]);

  const [content, setContent] = useState("");
  const [contentStyle, setContentStyle] = useState<CapsuleContentStyle>("simple");
  const [showAttachmentTools, setShowAttachmentTools] = useState(false);
  const [pendingLinkedDocuments, setPendingLinkedDocuments] = useState<DocumentSummary[]>([]);
  const [recordedFiles, setRecordedFiles] = useState<File[]>([]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [friendsResult, categoriesResult, documentsResult, dossiersResult, assetsResult] =
        await Promise.all([
          listFriends(supabase, masterKey),
          listCategories(supabase),
          listDocumentSummaries(supabase, masterKey),
          listDossiers(supabase, masterKey),
          listAssets(supabase, masterKey),
        ]);
      setFriends(friendsResult);
      setCategories(categoriesResult);
      setDocuments(documentsResult);
      setDossiers(dossiersResult);

      // Una capsula già avviata da un documento, un fascicolo o un bene: titolo, lettera e allegati arrivano da lì.
      const source = parseStarter(starterParam);
      const starter = source
        ? buildCapsuleStarter(source, { documents: documentsResult, dossiers: dossiersResult, assets: assetsResult })
        : null;
      if (starter) {
        setTitle(starter.title);
        setTitleTouched(true);
        setContent(starter.content);
        setPendingLinkedDocuments(starter.documents);
        setOpenOnLegacy(starter.openOnLegacy);
        setStarterOrigin(starter.origin);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile caricare i dati necessari.");
    } finally {
      setLoading(false);
    }
  }, [supabase, masterKey, starterParam]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const appearance = await getCapsuleAppearance(supabase, user.id);
        if (!cancelled && !effectTouched) setOpenEffect(appearance.openEffect);
      } catch {
        // Resta il default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, effectTouched]);

  function handlePickTemplate(next: CapsuleTemplate | null) {
    setTemplate(next);
    if (!titleTouched) setTitle(next ? next.title : "");
    if (!openAtTouched) setOpenAt(next ? (suggestedOpenAt(next, new Date()) ?? "") : "");
  }

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
        openEffect,
        relatedFriendIds: pendingRelatedFriends.map((c) => c.id),
        files: recordedFiles,
        linkedDocumentIds: pendingLinkedDocuments.map((d) => d.id),
        openAt,
        openOnLegacy,
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

      {!loading && step === 1 ? <CapsuleTemplatePicker selected={template} onPick={handlePickTemplate} /> : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Caricamento…</p>
      ) : (
        <CapsuleFormCard onSubmit={handleCreate}>
          {step === 1 ? (
            <>
              {starterOrigin ? (
                <p role="status" className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                  Stai preparando una capsula da <b>{starterOrigin}</b>. Scegli a chi farla arrivare e quando: la regola
                  &ldquo;anche prima, se non ci sono più&rdquo; è già accesa.
                </p>
              ) : null}

              <CapsuleTitleField
                value={title}
                onChange={(value) => {
                  setTitle(value);
                  setTitleTouched(true);
                }}
                placeholder="es. Per Maria"
              />

              <FriendPicker
                idPrefix="create"
                friends={activeFriends}
                selected={pendingRelatedFriends}
                onChange={setPendingRelatedFriends}
              />

              <CapsuleOpenAtField
                id="openAt"
                value={openAt}
                onChange={(value) => {
                  setOpenAt(value);
                  setOpenAtTouched(true);
                }}
              />

              <CapsuleLegacyField id="openOnLegacy" checked={openOnLegacy} onChange={setOpenOnLegacy} />

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
                prompts={promptsFor(template)}
              />

              {template ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Dal modello «{template.name}», di solito ci stanno bene: {template.attachmentIdeas.join(", ").toLowerCase()}.
                </p>
              ) : null}

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

              <CapsuleOpenEffectPicker
                idPrefix="create"
                value={openEffect}
                onChange={(next) => {
                  setOpenEffect(next);
                  setEffectTouched(true);
                }}
                title={title}
                letter={content}
                letterStyle={contentStyle}
                attachments={previewAttachments([
                  ...recordedFiles.map((f) => ({ filename: f.name, mimeType: f.type || "application/octet-stream", size: f.size })),
                  ...pendingLinkedDocuments.map((d) => ({ id: d.id, filename: d.filename, mimeType: d.mimeType, size: d.size })),
                ])}
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
