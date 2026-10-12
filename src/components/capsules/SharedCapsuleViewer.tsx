"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { openSharedCapsule } from "@/domain/capsules/repository";
import { CapsuleReplyBox } from "@/components/capsules/CapsuleReplyBox";
import { formatDateTime } from "@/components/capsules/CapsuleCardParts";
import { OpenEffectRenderer } from "@/components/capsules/opening/OpenEffectRenderer";
import { LiveAttachment } from "@/components/capsules/opening/OpenedParts";
import type { OpenOrigin, OpenedCapsuleSlots, OpenedCapsuleView } from "@/components/capsules/opening/types";
import { parseOpenEffect } from "@/domain/capsules/open-effects";
import type { SharedCapsuleListItem, SharedCapsuleOpenedContent } from "@/domain/capsules/types";

/**
 * FASE C1 --- apre davvero una capsula condivisa: a differenza di CapsulePreview (il proprietario, sui propri dati già
 * decifrati), qui il contenuto non è ancora in memoria all'apertura --- `openSharedCapsule()` scatta quando si sceglie la
 * capsula, una volta per apertura (mai ripetuto solo perché il pannello si richiude e riapre sulla stessa capsula già aperta
 * in questa sessione, v. `content` che resta finché non cambia la capsula).
 *
 * Una volta decifrata, la capsula si presenta con l'effetto scelto da chi l'ha scritta (v. domain/capsules/open-effects.ts e
 * components/capsules/opening/): le capsule di prima, senza una scelta, si aprono con lo "Sblocco discreto".
 */
export function SharedCapsuleViewer({
  masterKey,
  shared,
  origin,
  onClose,
}: {
  masterKey: CryptoKey;
  /** null --- niente da mostrare. */
  shared: SharedCapsuleListItem | null;
  /** L'oblò (o la capsula) da cui parte l'apertura, per gli effetti che si allargano o escono da lì. */
  origin: OpenOrigin | null;
  onClose: () => void;
}) {
  const supabase = useSupabase();
  const capsuleId = shared?.id ?? null;

  const [content, setContent] = useState<SharedCapsuleOpenedContent | null>(null);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!capsuleId || capsuleId === loadedForId) return;
    let cancelled = false;
    // Fetch-on-mount (v. DocumentsPanel.tsx per il motivo per cui è legittimo qui).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setContent(null);
    (async () => {
      try {
        const result = await openSharedCapsule(supabase, masterKey, capsuleId);
        if (!cancelled) {
          setContent(result);
          setLoadedForId(capsuleId);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile aprire la capsula.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capsuleId, loadedForId, masterKey, supabase]);

  // Finché si decifra (o se qualcosa va storto) Esc chiude; a capsula aperta ci pensa l'effetto.
  const waiting = shared !== null && !(content && loadedForId === shared.id);
  useEffect(() => {
    if (!waiting) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [waiting, onClose]);

  const view: OpenedCapsuleView | null = useMemo(() => {
    if (!shared || !content || loadedForId !== shared.id) return null;
    return {
      title: content.title,
      ownerName: shared.ownerName,
      letter: content.content,
      letterStyle: content.contentStyle,
      attachments: content.attachments,
      story: [
        { label: `Condivisa con te da ${shared.ownerName}`, when: formatDateTime(shared.sharedAt) },
        ...(shared.openAt ? [{ label: "Si apriva il", when: formatDateTime(shared.openAt) }] : []),
        { label: "Aperta", when: "ora", now: true },
      ],
    };
  }, [shared, content, loadedForId]);

  if (!shared) return null;

  if (!view || !content) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Capsula condivisa"
          onClick={(e) => e.stopPropagation()}
          className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Da {shared.ownerName}</p>
          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Decifratura in corso…</p>
          ) : null}
          <button type="button" onClick={onClose} className="w-fit rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  const attachmentsById = new Map(content.attachments.map((a) => [a.id, a]));
  const slots: OpenedCapsuleSlots = {
    renderAttachment: (attachment, tone) => {
      const full = attachmentsById.get(attachment.id);
      return full ? <LiveAttachment attachment={full} ownerId={shared.ownerId} capsuleId={shared.id} tone={tone} /> : null;
    },
    reply: <CapsuleReplyBox capsuleId={shared.id} ownerId={shared.ownerId} ownerName={shared.ownerName} />,
  };

  return <OpenEffectRenderer effect={parseOpenEffect(content.openEffect)} view={view} slots={slots} origin={origin} onClose={onClose} />;
}
