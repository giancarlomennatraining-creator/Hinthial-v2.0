"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { repliesLabel } from "@/domain/capsules/replies";
import type { CapsuleReply } from "@/domain/capsules/replies-repository";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";

/**
 * I pensieri che i destinatari hanno lasciato su una capsula (v. CapsuleReplyBox): li hai ricevuti cifrati, qui si leggono con
 * la tua chiave. Ognuno si può togliere dalla raccolta.
 */
export function CapsuleRepliesDialog({
  title,
  replies,
  busyId,
  onDelete,
  onClose,
}: {
  /** null: niente da mostrare, ma il componente resta montato per animare l'uscita. */
  title: string | null;
  replies: CapsuleReply[];
  busyId: string | null;
  onDelete: (reply: CapsuleReply) => void;
  onClose: () => void;
}) {
  const open = title !== null;
  const { mounted, entered } = useMountedTransition(open, 150);

  // Il titolo resta quello durante la dissolvenza in uscita.
  const [displayTitle, setDisplayTitle] = useState(title);
  if (title !== null && title !== displayTitle) setDisplayTitle(title);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

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
        aria-label="Pensieri ricevuti"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col gap-4 rounded-card border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {repliesLabel(replies.length)} su
            </p>
            <h2 className="mt-0.5 truncate text-xl font-extrabold text-zinc-900 dark:text-zinc-50">{displayTitle}</h2>
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

        {replies.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessun pensiero, per ora.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {replies.map((reply) => (
              <li key={reply.id} className="flex flex-col gap-2 rounded-xl border border-[#EDE1C4] bg-[#FBF6EA] px-4 py-3">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#3B331F]">{reply.message}</p>
                <div className="flex items-center justify-between gap-3 text-xs text-[#6B5730]">
                  <span>
                    <strong>{reply.authorName}</strong> · {formatDate(reply.createdAt)}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === reply.id}
                    onClick={() => onDelete(reply)}
                    className="font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {busyId === reply.id ? "Tolgo…" : "Togli"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
