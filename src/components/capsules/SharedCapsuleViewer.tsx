"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { downloadSharedCapsuleAttachment, openSharedCapsule } from "@/domain/capsules/repository";
import { contentKindFor, CONTENT_KIND_ICON, hasInlinePlayer } from "@/lib/content-kind";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";
import type { SharedCapsuleAttachment, SharedCapsuleOpenedContent } from "@/domain/capsules/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * FASE C1 --- apre davvero una capsula condivisa: a differenza di
 * CapsulePreview (il proprietario, sui propri dati già decifrati), qui
 * il contenuto non è ancora in memoria all'apertura del pannello ---
 * `openSharedCapsule()` scatta al montaggio, una volta per apertura
 * (mai ripetuto solo perché il pannello si richiude e riapre sulla
 * stessa capsula già aperta in questa sessione, v. `content` che resta
 * finché non cambia `capsuleId`).
 */
export function SharedCapsuleViewer({
  masterKey,
  capsuleId,
  ownerId,
  ownerName,
  onClose,
}: {
  masterKey: CryptoKey;
  /** null --- niente da mostrare (v. CapsulePreview per lo stesso schema di dissolvenza in-out). */
  capsuleId: string | null;
  ownerId: string;
  ownerName: string;
  onClose: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const open = capsuleId !== null;
  const { mounted, entered } = useMountedTransition(open, 150);

  const [content, setContent] = useState<SharedCapsuleOpenedContent | null>(null);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  if (!mounted) return null;

  async function downloadBytes(attachment: SharedCapsuleAttachment) {
    return downloadSharedCapsuleAttachment(supabase, ownerId, capsuleId as string, attachment);
  }

  async function togglePlayer(attachment: SharedCapsuleAttachment) {
    if (playingId === attachment.id) {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
      setPlayingId(null);
      setPlayerUrl(null);
      return;
    }

    if (playerUrl) URL.revokeObjectURL(playerUrl);
    setPlayingId(attachment.id);
    setPlayerUrl(null);
    setPlayerLoading(true);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadBytes(attachment);
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      setPlayerUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile riprodurre il contenuto.");
      setPlayingId(null);
    } finally {
      setPlayerLoading(false);
    }
  }

  async function handleOpenAttachment(attachment: SharedCapsuleAttachment) {
    setBusyId(attachment.id);
    setError(null);
    try {
      const { filename, mimeType, bytes } = await downloadBytes(attachment);
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire l'allegato.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] transition-opacity duration-150",
        entered ? "opacity-100" : "opacity-0",
      )}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capsula condivisa"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Da {ownerName}
            </p>
            {content ? (
              <h2 className="mt-0.5 truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {content.title}
              </h2>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="shrink-0 rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ✕
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Decifratura in corso…</p>
        ) : content ? (
          <>
            <div className="rounded-2xl border border-[#EDE1C4] bg-[#FBF6EA] px-6 py-5">
              {content.content ? (
                <p
                  className={
                    content.contentStyle === "handwritten"
                      ? "whitespace-pre-wrap font-caveat text-[22px] leading-relaxed text-[#3B331F]"
                      : "whitespace-pre-wrap text-sm leading-relaxed text-[#3B331F]"
                  }
                >
                  {content.content}
                </p>
              ) : (
                <p className="text-sm text-[#8F7A4A]">Nessun testo scritto.</p>
              )}
            </div>

            {content.attachments.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {content.attachments.map((attachment) => {
                  const kind = contentKindFor(attachment.mimeType);
                  const isPlaying = playingId === attachment.id;
                  return (
                    <li key={attachment.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900">
                        <span className="truncate text-zinc-700 dark:text-zinc-300">
                          {CONTENT_KIND_ICON[kind]} {attachment.filename} · {formatSize(attachment.size)}
                        </span>
                        <div className="flex shrink-0 gap-3">
                          {hasInlinePlayer(kind) ? (
                            <button
                              type="button"
                              onClick={() => togglePlayer(attachment)}
                              className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                            >
                              {isPlaying ? "Nascondi" : "Riproduci"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={busyId === attachment.id}
                            onClick={() => handleOpenAttachment(attachment)}
                            className="font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                          >
                            {busyId === attachment.id ? "Apertura…" : "Apri"}
                          </button>
                        </div>
                      </div>

                      {isPlaying ? (
                        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                          {playerLoading || !playerUrl ? (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
                          ) : kind === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
                            <img src={playerUrl} alt={attachment.filename} className="max-h-72 max-w-full rounded-md" />
                          ) : kind === "video" ? (
                            <video src={playerUrl} controls className="max-h-72 max-w-full rounded-md" />
                          ) : (
                            <audio src={playerUrl} controls className="w-full" />
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
