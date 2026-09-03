"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { downloadCapsuleAttachment } from "@/domain/capsules/repository";
import { downloadDocument } from "@/domain/documents/repository";
import { saveBytesAsFile } from "@/lib/download";
import { contentKindFor, CONTENT_KIND_ICON, hasInlinePlayer } from "@/lib/content-kind";
import type { CapsuleAttachment, CapsuleListItem } from "@/domain/capsules/types";
import type { DocumentListItem } from "@/domain/documents/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Una riga della lista, indipendentemente dal fatto che sia un CapsuleAttachment o un DocumentListItem collegato. */
type PreviewItem =
  | { source: "attachment"; id: string; filename: string; mimeType: string; size: number }
  | { source: "linked"; id: string; filename: string; mimeType: string; size: number };

/**
 * "Così la vedrà chi la riceve" --- un'anteprima di sola lettura di
 * cosa contiene una capsula oggi, prima ancora che venga chiusa:
 * titolo, contenuto scritto, e ogni allegato/contenuto collegato, con
 * lo stesso player inline usato altrove (v. DocumentsPanel). Non è la
 * vera esperienza di apertura da parte del destinatario --- quella
 * arriverà con una fase futura (v. HINTHIAL_MVP.md, Dead Man's
 * Switch) --- solo una simulazione sullo schermo di chi sta scrivendo.
 */
export function CapsulePreview({
  masterKey,
  capsule,
  onClose,
}: {
  masterKey: CryptoKey;
  capsule: CapsuleListItem;
  onClose: () => void;
}) {
  const supabase = useRef(createClient()).current;

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Player inline --- un solo elemento aperto alla volta, come in DocumentsPanel.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerLoading, setPlayerLoading] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Libera sempre l'object URL, sia allo smontaggio sia cambiando elemento.
  useEffect(() => {
    return () => {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
    };
  }, [playerUrl]);

  const items: PreviewItem[] = [
    ...capsule.attachments.map((a) => ({
      source: "attachment" as const,
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
    })),
    ...capsule.linkedDocuments.map((d) => ({
      source: "linked" as const,
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      size: d.size,
    })),
  ];

  function attachmentFor(id: string): CapsuleAttachment | undefined {
    return capsule.attachments.find((a) => a.id === id);
  }

  function linkedDocumentFor(id: string): DocumentListItem | undefined {
    return capsule.linkedDocuments.find((d) => d.id === id);
  }

  async function downloadBytes(item: PreviewItem): Promise<{ mimeType: string; bytes: Uint8Array }> {
    if (item.source === "attachment") {
      const attachment = attachmentFor(item.id);
      if (!attachment) throw new Error("Allegato non trovato.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      return downloadCapsuleAttachment(supabase, masterKey, user.id, capsule.id, attachment);
    }

    const doc = linkedDocumentFor(item.id);
    if (!doc) throw new Error("Contenuto collegato non trovato.");
    return downloadDocument(supabase, masterKey, doc);
  }

  async function togglePlayer(item: PreviewItem) {
    if (playingId === item.id) {
      if (playerUrl) URL.revokeObjectURL(playerUrl);
      setPlayingId(null);
      setPlayerUrl(null);
      return;
    }

    if (playerUrl) URL.revokeObjectURL(playerUrl);
    setPlayingId(item.id);
    setPlayerUrl(null);
    setPlayerLoading(true);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadBytes(item);
      const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
      setPlayerUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile riprodurre il contenuto.");
      setPlayingId(null);
    } finally {
      setPlayerLoading(false);
    }
  }

  async function handleOpen(item: PreviewItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const { mimeType, bytes } = await downloadBytes(item);
      saveBytesAsFile(bytes, item.filename, mimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aprire il contenuto.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Anteprima capsula"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Così la vedrà chi la riceve
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {capsule.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi anteprima"
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

        {capsule.content ? (
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{capsule.content}</p>
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-600">Nessun testo scritto.</p>
        )}

        {items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const kind = contentKindFor(item.mimeType);
              const isPlaying = playingId === item.id;
              return (
                <li key={`${item.source}-${item.id}`} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-1.5 text-xs dark:bg-zinc-900">
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {CONTENT_KIND_ICON[kind]} {item.filename} · {formatSize(item.size)}
                    </span>
                    <div className="flex shrink-0 gap-3">
                      {hasInlinePlayer(kind) ? (
                        <button
                          type="button"
                          onClick={() => togglePlayer(item)}
                          className="font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                        >
                          {isPlaying ? "Nascondi" : "Riproduci"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleOpen(item)}
                        className="font-medium text-zinc-600 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-400"
                      >
                        {busyId === item.id ? "Apertura…" : "Apri"}
                      </button>
                    </div>
                  </div>

                  {isPlaying ? (
                    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                      {playerLoading || !playerUrl ? (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Caricamento…</p>
                      ) : kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element -- object URL locale, decifrata sul dispositivo
                        <img src={playerUrl} alt={item.filename} className="max-h-72 max-w-full rounded-md" />
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

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Solo un&apos;anteprima su questo schermo --- nessun accesso reale viene concesso ai
          destinatari a questo punto.
        </p>
      </div>
    </div>
  );
}
