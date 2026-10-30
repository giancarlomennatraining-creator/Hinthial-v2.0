"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import {
  closeCapsule,
  deleteCapsule,
  downloadCapsuleAttachment,
  listCapsules,
  listCapsulesSharedWithMe,
  setCapsuleOpenOnLegacy,
  shareCapsule,
} from "@/domain/capsules/repository";
import { deleteReply, listReceivedReplies, type CapsuleReply } from "@/domain/capsules/replies-repository";
import { downloadDocument } from "@/domain/documents/repository";
import { lookupFriendAccount, setFriendLinkedUser } from "@/domain/friends/repository";
import { getCapsuleCountdownVisible } from "@/domain/profile/repository";
import { cn, errorMessage } from "@/lib/utils";
import { saveBytesAsFile } from "@/lib/download";
import { contentKindFor, CONTENT_KIND_ICON } from "@/lib/content-kind";
import { isOpened } from "@/components/capsules/CapsuleCardParts";
import { CapsulePortholeRow } from "@/components/capsules/CapsulePortholeRow";
import { SharedCapsuleItem } from "@/components/capsules/SharedCapsuleItem";
import type { OpenOrigin } from "@/components/capsules/opening/types";
import { CapsuleCountdown } from "@/components/capsules/CapsuleCountdown";
import { CapsuleRepliesDialog } from "@/components/capsules/CapsuleRepliesDialog";
import { CloseCapsuleDialog } from "@/components/capsules/CloseCapsuleDialog";
import { CapsulePreview } from "@/components/capsules/CapsulePreview";
import { SharedCapsuleViewer } from "@/components/capsules/SharedCapsuleViewer";
import { MobileAddFab } from "@/components/ui/MobileAddFab";
import { PageHelp } from "@/components/help/PageHelp";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RowActionsMenu, RowMenuItem } from "@/components/ui/RowActionsMenu";
import { sortByOpening } from "@/domain/capsules/overview";
import type {
  CapsuleAttachment,
  CapsuleListItem,
  SharedCapsuleListItem,
} from "@/domain/capsules/types";
import type { DocumentListItem } from "@/domain/documents/types";
import { useToast } from "@/components/ui/ToastProvider";
import { BTN_PRIMARY } from "@/components/ui/styles";
import { EmptyListCard } from "@/components/ui/EmptyListCard";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { ErrorText } from "@/components/ui/ErrorText";
import { useVaultState } from "@/lib/use-vault-state";
import { VAULT } from "@/lib/vault-store";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


/**
 * Capsule digitali: titolo, contenuto, allegati, data di apertura (in chiaro, unica eccezione allo zero-knowledge in
 * questa tabella) e destinatari; stato manuale bozza -> chiusa -> condivisa. Chiudere è irreversibile: copia ogni
 * contenuto d'Archivio ancora collegato dentro la capsula (v. closeCapsule), che da quel momento non dipende più
 * dagli originali. Non concede ancora alcun accesso ai destinatari (v. HINTHIAL_MVP.md).
 */
export function CapsulesPanel({ masterKey }: { masterKey: CryptoKey }) {
  const supabase = useSupabase();
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useToast();

  const [capsules, setCapsules, hitCapsules] = useVaultState<CapsuleListItem[]>(masterKey, VAULT.capsules, []);
  const [loading, setLoading] = useState(!hitCapsules);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAttachment, setBusyAttachment] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [previewCapsule, setPreviewCapsule] = useState<CapsuleListItem | null>(null);
  // La bozza di cui si sta per decidere la chiusura (v. CloseCapsuleDialog): chiudere è irreversibile, si fa prima il punto.
  const [closingCapsule, setClosingCapsule] = useState<CapsuleListItem | null>(null);
  // I pensieri che i destinatari hanno lasciato (v. CapsuleReplyBox), per capsula; e la capsula di cui si stanno leggendo.
  const [replies, setReplies] = useState<CapsuleReply[]>([]);
  const [readingRepliesFor, setReadingRepliesFor] = useState<CapsuleListItem | null>(null);
  const [busyReplyId, setBusyReplyId] = useState<string | null>(null);
  const [openingShared, setOpeningShared] = useState<SharedCapsuleListItem | null>(null);
  // Da dove parte l'apertura (l'oblò o la capsula toccati), per gli effetti che si allargano o escono da lì.
  const [openingOrigin, setOpeningOrigin] = useState<OpenOrigin | null>(null);
  // L'elenco aspetta di sapere se mostrare il conto alla rovescia, per non lampeggiare.

  // "Condivise con me" è una scheda qui dentro, non una voce di menu a parte. Caricata insieme alle proprie capsule, così passare da una vista all'altra è istantaneo.
  const [activeTab, setActiveTab] = useState<"mine" | "shared">(() => (searchParams.get("tab") === "shared" ? "shared" : "mine"));
  const [sharedCapsules, setSharedCapsules] = useVaultState<SharedCapsuleListItem[]>(masterKey, VAULT.capsulesShared, []);
  const [sharedError, setSharedError] = useState<string | null>(null);

  // Impostazioni > Aspetto (v. CapsuleCountdownSettings). Default true mentre si attende la risposta.
  const [showCountdown, setShowCountdown, hitCountdown] = useVaultState<boolean>(masterKey, VAULT.capsuleCountdown, true);
  // Con la preferenza già in memoria l'elenco non aspetta la risposta.
  const [prefsReady, setPrefsReady] = useState(hitCountdown);

  // "?created=1"/"?updated=1": solo un flag, mai il titolo o contenuto (finirebbe in chiaro nell'URL). Stato pigro: il messaggio non deve sparire quando ripuliamo l'URL con router.replace.
  const [showCreatedMessage] = useState(() => searchParams.get("created") === "1");
  const [showUpdatedMessage] = useState(() => searchParams.get("updated") === "1");
  // Una capsula condivisa la cui data arriva mentre la pagina è aperta cambia aspetto da sola, senza ricaricare.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (showCreatedMessage) showToast("Capsula creata.");
    if (showUpdatedMessage) showToast("Capsula aggiornata.");
    if (showCreatedMessage || showUpdatedMessage) router.replace("/capsules");
  }, [showCreatedMessage, showUpdatedMessage, router, showToast]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const capsulesResult = await listCapsules(supabase, masterKey);
      setCapsules(capsulesResult);
    } catch (err) {
      setError(errorMessage(err, "Impossibile caricare le capsule."));
    } finally {
      setLoading(false);
    }

    // Best-effort e separato: nessuna decrittazione qui, un fallimento non deve impedire di vedere le proprie capsule.
    setSharedError(null);
    try {
      setSharedCapsules(await listCapsulesSharedWithMe(supabase));
    } catch (err) {
      setSharedError(errorMessage(err, "Impossibile caricare le capsule condivise con te."));
    }

    // Best-effort: i pensieri ricevuti non devono mai impedire di vedere le proprie capsule.
    // Non si aspetta: arrivano quando arrivano, senza rallentare il resto della pagina.
    listReceivedReplies(supabase, masterKey)
      .then(setReplies)
      .catch(() => {
        // Nessun pensiero mostrato.
      });

    // Best-effort: se fallisce si resta sul default (conto alla rovescia visibile).
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setShowCountdown(await getCapsuleCountdownVisible(supabase, user.id).catch(() => true));
    } catch {
      // Restano i default.
    } finally {
      setPrefsReady(true);
    }
  }, [supabase, masterKey, setCapsules, setSharedCapsules, setShowCountdown]);

  useEffect(() => {
    // See DocumentsPanel.tsx for why fetch-on-mount is legitimate here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  /** La conferma l'ha già data CloseCapsuleDialog: qui si chiude davvero (copiando i contenuti collegati, v. closeCapsule). */
  async function handleClose(capsule: CapsuleListItem) {
    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await closeCapsule(supabase, masterKey, user.id, capsule);
      await refresh();
      showToast("Capsula chiusa.");
    } catch (err) {
      setError(errorMessage(err, "Impossibile chiudere la capsula."));
    } finally {
      setBusyId(null);
      setClosingCapsule(null);
    }
  }

  async function handleDeleteReply(reply: CapsuleReply) {
    setBusyReplyId(reply.id);
    setError(null);
    try {
      await deleteReply(supabase, reply.id);
      setReplies((prev) => prev.filter((r) => r.id !== reply.id));
    } catch (err) {
      setError(errorMessage(err, "Impossibile togliere il pensiero."));
    } finally {
      setBusyReplyId(null);
    }
  }

  async function handleShare(capsule: CapsuleListItem) {
    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      // Un amico si "collega" a un account solo quando qualcuno lo verifica (v. FriendsPanel): se l'account è nato dopo, qui
      // il legame mancherebbe e la capsula resterebbe invisibile al destinatario. Si verifica quindi al momento di condividere.
      const relatedFriends = await Promise.all(
        capsule.relatedFriends.map(async (friend) => {
          if (friend.linkedUserId !== null) return friend;
          try {
            const match = await lookupFriendAccount(supabase, friend.email);
            if (!match) return friend;
            await setFriendLinkedUser(supabase, friend.id, match.userId);
            return { ...friend, linkedUserId: match.userId };
          } catch {
            return friend;
          }
        }),
      );
      const notLinked = relatedFriends.filter((friend) => friend.linkedUserId === null);

      await shareCapsule(supabase, masterKey, user.id, { ...capsule, relatedFriends });
      setCapsules((prev) => prev.map((c) => (c.id === capsule.id ? { ...c, status: "shared", relatedFriends } : c)));
      showToast(
        notLinked.length > 0
          ? `Capsula condivisa. ${notLinked.map((f) => f.name).join(", ")} non ha ancora un account Hinthial con quell'email: quando lo avrà, apri Amici e la capsula gli arriverà.`
          : "Capsula condivisa.",
      );
    } catch (err) {
      setError(errorMessage(err, "Impossibile condividere la capsula."));
    } finally {
      setBusyId(null);
    }
  }

  /** Accende o spegne "aprila anche prima, se non ci sono più" per una capsula già chiusa: vale finché non si è aperta. */
  async function handleToggleOpenOnLegacy(capsule: CapsuleListItem) {
    const next = !capsule.openOnLegacy;
    setBusyId(capsule.id);
    setError(null);
    try {
      await setCapsuleOpenOnLegacy(supabase, capsule.id, next);
      setCapsules((prev) => prev.map((c) => (c.id === capsule.id ? { ...c, openOnLegacy: next } : c)));
      showToast(next ? "Si aprirà anche prima, se non ci sei più." : "Si aprirà solo alla data scelta.");
    } catch (err) {
      setError(errorMessage(err, "Impossibile cambiare la regola della capsula."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(capsule: CapsuleListItem) {
    if (
      !(await confirm({
        message: `Eliminare la capsula "${capsule.title}"? L'operazione non è reversibile.`,
        confirmLabel: "Elimina",
        danger: true,
      }))
    )
      return;

    setBusyId(capsule.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      await deleteCapsule(supabase, masterKey, user.id, capsule);
      setCapsules((prev) => prev.filter((c) => c.id !== capsule.id));
    } catch (err) {
      setError(errorMessage(err, "Impossibile eliminare la capsula."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpenAttachment(capsule: CapsuleListItem, attachment: CapsuleAttachment) {
    setBusyAttachment(attachment.id);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");

      const { filename, mimeType, bytes } = await downloadCapsuleAttachment(
        supabase,
        masterKey,
        user.id,
        capsule.id,
        attachment,
      );
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(errorMessage(err, "Impossibile aprire l'allegato."));
    } finally {
      setBusyAttachment(null);
    }
  }

  /** Same download path Documenti itself uses --- a linked document is never copied, just referenced. */
  async function handleOpenLinkedDocument(doc: DocumentListItem) {
    setBusyAttachment(doc.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadDocument(supabase, masterKey, doc);
      saveBytesAsFile(bytes, filename, mimeType);
    } catch (err) {
      setError(errorMessage(err, "Impossibile aprire il documento."));
    } finally {
      setBusyAttachment(null);
    }
  }

  /** Il menu delle azioni di una capsula. */
  function renderMenu(capsule: CapsuleListItem, busy: boolean) {
    return (
      <RowActionsMenu label={`Azioni per "${capsule.title}"`}>
        <RowMenuItem disabled={busy} onClick={() => setPreviewCapsule(capsule)}>
          Anteprima
        </RowMenuItem>
        {capsule.status === "draft" ? (
          <RowMenuItem disabled={busy} onClick={() => router.push(`/capsules/${capsule.id}/edit`)}>
            Modifica
          </RowMenuItem>
        ) : null}
        {capsule.status === "draft" ? (
          <RowMenuItem disabled={busy} onClick={() => setClosingCapsule(capsule)}>
            Chiudi la capsula
          </RowMenuItem>
        ) : null}
        {capsule.status === "ready" ? (
          <RowMenuItem disabled={busy} onClick={() => handleShare(capsule)}>
            Condividi
          </RowMenuItem>
        ) : null}
        {capsule.status !== "draft" && !isOpened(capsule, now) ? (
          <RowMenuItem disabled={busy} onClick={() => handleToggleOpenOnLegacy(capsule)}>
            {capsule.openOnLegacy ? "Aprila solo alla data" : "Aprila anche prima, se non ci sono più"}
          </RowMenuItem>
        ) : null}
        <RowMenuItem disabled={busy} danger onClick={() => handleDelete(capsule)}>
          Elimina
        </RowMenuItem>
      </RowActionsMenu>
    );
  }

  /** I contenuti di una capsula (allegati e documenti d'Archivio collegati), con la loro azione: "Apri". */
  function renderContents(capsule: CapsuleListItem) {
    if (capsule.attachments.length === 0 && capsule.linkedDocuments.length === 0) return null;
    return (
      <ul className="flex flex-col gap-1">
        {capsule.attachments.map((attachment) => {
          const kind = contentKindFor(attachment.mimeType);
          return (
            <li key={attachment.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900">
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {CONTENT_KIND_ICON[kind]} {attachment.filename} · {formatSize(attachment.size)}
                </span>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    disabled={busyAttachment === attachment.id}
                    onClick={() => handleOpenAttachment(capsule, attachment)}
                    className="font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    {busyAttachment === attachment.id ? "Apertura…" : "Apri"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
        {capsule.linkedDocuments.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900"
          >
            <span className="truncate text-zinc-700 dark:text-zinc-300">
              {CONTENT_KIND_ICON[contentKindFor(doc.mimeType)]} {doc.filename} · {formatSize(doc.size)}
            </span>
            <button
              type="button"
              disabled={busyAttachment === doc.id}
              onClick={() => handleOpenLinkedDocument(doc)}
              className="shrink-0 font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
            >
              {busyAttachment === doc.id ? "Apertura…" : "Apri"}
            </button>
          </li>
        ))}
      </ul>
    );
  }


  return (
    <div className="flex flex-col gap-6 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="flex min-w-0 w-full items-start justify-between gap-3 sm:flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-title">
            Capsule
          </h1>
          {/* Il dettaglio sull'irreversibilità del chiudere è ripetuto al momento di farlo (v. CloseCapsuleDialog):
              qui basta un consiglio, non serve più il <details> a parte. */}
          <PageHelp
            title="Capsule"
            tips={[
              { icon: "🔒", text: "Contenuti cifrati da lasciare a chi vuoi tu, in condizioni definite da te." },
              { icon: "⚠️", text: "Chiudere una capsula è irreversibile: non sarà più modificabile." },
              { icon: "📎", text: "Un contenuto d'Archivio collegato viene copiato dentro, l'originale resta libero." },
              { icon: "📖", text: "Un racconto di Raccontami si ricorda: la capsula lo consegna a una persona, quando vuoi tu. Da ogni racconto parte con \"Fallo arrivare a…\"." },
            ]}
          />
        </div>
        <Link
          href="/capsules/new"
          className={`hidden shrink-0 ${BTN_PRIMARY} sm:block`}
        >
          + Crea capsula
        </Link>
      </div>

      <MobileAddFab href="/capsules/new" label="Aggiungi capsula" />

      {/* Stesso stile a barra sottolineata dei tab di Archivio (v. ArchiveTabs.tsx) --- qui però sono due viste
          della stessa pagina, non due route: <button role="tab"> con stato locale, non <Link>. */}
      <div role="tablist" aria-label="Sezioni delle capsule" className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mine"}
          onClick={() => setActiveTab("mine")}
          className={cn(
            "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "mine"
              ? "border-brand text-accent"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          Le mie
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "shared"}
          onClick={() => setActiveTab("shared")}
          className={cn(
            "-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            activeTab === "shared"
              ? "border-brand text-accent"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
          )}
        >
          Condivise con me{sharedCapsules.length > 0 ? ` (${sharedCapsules.length})` : ""}
        </button>
      </div>

      {error ? (
        <ErrorText>
          {error}
        </ErrorText>
      ) : null}

      {activeTab === "shared" ? (
        sharedError ? (
          <ErrorText>
            {sharedError}
          </ErrorText>
        ) : sharedCapsules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna capsula condivisa con te, per ora.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sharedCapsules.map((shared) => (
              <SharedCapsuleItem
                key={shared.id}
                shared={shared}
                showCountdown={showCountdown}
                now={now}
                onOpen={(origin) => {
                  setOpeningOrigin(origin);
                  setOpeningShared(shared);
                }}
              />
            ))}
          </ul>
        )
      ) : loading || !prefsReady ? (
        <ListSkeleton />
      ) : capsules.length === 0 ? (
        <EmptyListCard text="Nessuna capsula ancora. Una capsula consegna a qualcuno ciò che hai scritto o raccontato." actionHref="/capsules/new" actionLabel="Scrivi la prima capsula" />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {sortByOpening(capsules, now).map((capsule) => (
              <CapsulePortholeRow
                key={capsule.id}
                capsule={capsule}
                now={now}
                menu={renderMenu(capsule, busyId === capsule.id)}
                repliesCount={replies.filter((r) => r.capsuleId === capsule.id).length}
                onOpenReplies={() => setReadingRepliesFor(capsule)}
                countdown={
                  capsule.openAt && capsule.status !== "draft" && showCountdown ? (
                    <CapsuleCountdown createdAt={capsule.createdAt} openAt={capsule.openAt} size="sm" showProgress />
                  ) : null
                }
              >
                {renderContents(capsule)}
              </CapsulePortholeRow>
            ))}
          </ul>
        </>
      )}

      <CapsuleRepliesDialog
        title={readingRepliesFor?.title ?? null}
        replies={readingRepliesFor ? replies.filter((r) => r.capsuleId === readingRepliesFor.id) : []}
        busyId={busyReplyId}
        onDelete={handleDeleteReply}
        onClose={() => setReadingRepliesFor(null)}
      />

      {/* Prima dell'anteprima: aprendola da qui, l'anteprima resta sopra. Sempre montato per lo stesso motivo. */}
      <CloseCapsuleDialog
        capsule={closingCapsule}
        now={now}
        busy={closingCapsule !== null && busyId === closingCapsule.id}
        previewOpen={previewCapsule !== null}
        onConfirm={handleClose}
        onOpenPreview={setPreviewCapsule}
        onCancel={() => setClosingCapsule(null)}
      />

      {/* L'anteprima è l'apertura vera, con l'effetto scelto per questa capsula: dopo la finestra di chiusura, per stare sopra. */}
      <CapsulePreview masterKey={masterKey} capsule={previewCapsule} onClose={() => setPreviewCapsule(null)} />

      {/* Sempre montato per lo stesso motivo di CapsulePreview qui sopra. */}
      <SharedCapsuleViewer
        masterKey={masterKey}
        shared={openingShared}
        origin={openingOrigin}
        onClose={() => setOpeningShared(null)}
      />
    </div>
  );
}
