"use client";

import { useState } from "react";
import { EffectShell } from "@/components/capsules/opening/EffectShell";
import { prefersReducedMotion } from "@/components/capsules/opening/helpers";
import type { OpenEffectProps } from "@/components/capsules/opening/types";
import { splitLetterLines } from "@/domain/capsules/open-effects";
import { cn } from "@/lib/utils";

/**
 * "Luce e lettera": la pagina si fa buia, dall'oblò toccato sale un chiarore caldo e la lettera appare riga per riga, a grandi
 * lettere. Niente riquadri: solo il testo, e in fondo gli allegati e il pensiero. "Salta" mostra subito tutto.
 */
export function EffectLight({ view, slots, origin, onClose }: OpenEffectProps) {
  const [skipped, setSkipped] = useState(prefersReducedMotion);
  const [replyOpen, setReplyOpen] = useState(false);
  const lines = splitLetterLines(view.letter);
  const [pos] = useState(() => origin ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.7, r: 30 });
  const after = lines.length;

  return (
    <EffectShell
      effect="light"
      onClose={onClose}
      closeTone="dark"
      className={cn("flex flex-col items-center overflow-auto bg-[#08113a] text-[#F4F7FF]", skipped && "capsule-skipped")}
    >
      <span
        aria-hidden="true"
        className="capsule-lamp pointer-events-none fixed h-10 w-10 rounded-full bg-[radial-gradient(circle,rgba(255,236,170,.95),rgba(255,214,120,.45)_40%,rgba(255,214,120,0)_70%)]"
        style={{ left: pos.x - 20, top: pos.y - 20 }}
      />
      {!skipped ? (
        <button type="button" onClick={() => setSkipped(true)} className="absolute left-4 top-4 z-[60] text-xs font-medium text-[#BFCBF0] underline-offset-2 hover:underline">
          Salta
        </button>
      ) : null}

      <div className="relative my-auto flex w-full max-w-lg flex-col gap-4 px-6 py-16 pr-14 text-left">
        <p className="capsule-line text-xs font-semibold uppercase tracking-wider text-[#BFCBF0]" style={{ ["--i" as string]: -1 }}>
          Da {view.ownerName}
        </p>
        <h2 className="capsule-line font-heading text-3xl font-extrabold text-white" style={{ ["--i" as string]: -0.5 }}>
          {view.title}
        </h2>
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <p
              key={`${i}-${line}`}
              className={cn("capsule-line text-[#FFF6DB]", view.letterStyle === "handwritten" ? "font-caveat text-[34px] leading-tight" : "text-xl leading-snug")}
              style={{ ["--i" as string]: i }}
            >
              {line}
            </p>
          ))
        ) : (
          <p className="capsule-line text-[#FFF6DB]/80" style={{ ["--i" as string]: 0 }}>
            Nessun testo scritto.
          </p>
        )}

        {view.attachments.length > 0 ? (
          <ul className="capsule-line flex flex-col gap-2" style={{ ["--i" as string]: after + 0.4 }}>
            {view.attachments.map((attachment) => (
              <li key={attachment.id}>{slots.renderAttachment(attachment, "dark")}</li>
            ))}
          </ul>
        ) : null}

        <div className="capsule-line flex flex-col gap-3" style={{ ["--i" as string]: after + 0.9 }}>
          {replyOpen ? (
            slots.reply
          ) : (
            <button
              type="button"
              onClick={() => setReplyOpen(true)}
              className="w-fit border-b border-[#FFE9A8]/60 text-sm font-semibold text-[#FFE9A8] hover:border-[#FFE9A8]"
            >
              Lascia un pensiero
            </button>
          )}
        </div>
      </div>
    </EffectShell>
  );
}
