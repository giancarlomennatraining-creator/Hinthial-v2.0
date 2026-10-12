"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canCloseCapsule, capsuleChecks, type CapsuleCheckState } from "@/domain/capsules/overview";
import type { CapsuleListItem } from "@/domain/capsules/types";
import { useMountedTransition } from "@/lib/use-mounted-transition";
import { cn } from "@/lib/utils";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/ui/styles";

const EXCERPT_LENGTH = 220;

const MARK: Record<CapsuleCheckState, { symbol: string; className: string; label: string }> = {
  ok: { symbol: "✓", className: "bg-[#e3f4ec] text-[#1c7c5a] dark:bg-green-950 dark:text-green-300", label: "A posto" },
  warn: { symbol: "!", className: "bg-[#fdf3dd] text-[#8a5a00] dark:bg-amber-950 dark:text-amber-300", label: "Attenzione" },
  todo: { symbol: "×", className: "bg-[#fde9e7] text-[#b42318] dark:bg-red-950 dark:text-red-300", label: "Manca" },
};

/**
 * "Prima di chiudere": chiudere una capsula è irreversibile (non si cambiano più lettera, allegati, data né destinatari), quindi
 * invece di un "Sei sicuro?" si fa il punto: cosa c'è, cosa manca, cosa potrebbe andare storto (v. domain/capsules/overview.ts,
 * `capsuleChecks`), con un'anteprima della lettera e il passaggio all'anteprima completa. Senza lettera né allegato non si
 * chiude; gli avvisi lasciano scegliere.
 */
export function CloseCapsuleDialog({
  capsule,
  now,
  busy,
  previewOpen,
  onConfirm,
  onOpenPreview,
  onCancel,
}: {
  /** null: niente da mostrare, ma il componente resta montato per animare l'uscita. */
  capsule: CapsuleListItem | null;
  now: Date;
  busy: boolean;
  /** Mentre l'anteprima completa è aperta sopra, Esc chiude quella e non questa finestra. */
  previewOpen: boolean;
  onConfirm: (capsule: CapsuleListItem) => void;
  onOpenPreview: (capsule: CapsuleListItem) => void;
  onCancel: () => void;
}) {
  const open = capsule !== null;
  const { mounted, entered } = useMountedTransition(open, 150);

  // L'ultima capsula non nulla ricevuta: il contenuto resta quello durante la dissolvenza in uscita.
  const [displayCapsule, setDisplayCapsule] = useState(capsule);
  if (capsule !== null && capsule !== displayCapsule) setDisplayCapsule(capsule);

  useEffect(() => {
    if (!open || previewOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, previewOpen, busy, onCancel]);

  if (!mounted || !displayCapsule) return null;
  const shown: CapsuleListItem = displayCapsule;

  const checks = capsuleChecks(shown, now);
  const canClose = canCloseCapsule(checks);
  const linked = shown.linkedDocuments.length;
  const trimmed = shown.content.trim();
  const excerpt = trimmed.length > EXCERPT_LENGTH ? `${trimmed.slice(0, EXCERPT_LENGTH).trimEnd()}…` : trimmed;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] transition-opacity duration-150",
        entered ? "opacity-100" : "opacity-0",
      )}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Prima di chiudere la capsula"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Prima di chiudere</p>
          <h2 className="font-heading text-xl font-extrabold text-[#121a35] dark:text-zinc-50">{shown.title}</h2>
        </div>

        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {checks.map((check) => (
            <li key={check.id} className="flex items-start gap-3 py-2.5 text-sm">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MARK[check.state].className}`}
                role="img"
                aria-label={MARK[check.state].label}
              >
                {MARK[check.state].symbol}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-[#121a35] dark:text-zinc-100">{check.label}</span>
                <span className="text-zinc-600 dark:text-zinc-400">{check.detail}</span>
              </div>
            </li>
          ))}
        </ul>

        {excerpt ? (
          <div className="flex flex-col gap-1.5 rounded-xl border border-[#EDE1C4] bg-[#FBF6EA] px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B5730]">Così comincia la lettera</span>
            <p
              className={
                shown.contentStyle === "handwritten"
                  ? "whitespace-pre-wrap font-caveat text-[22px] leading-snug text-[#3B331F]"
                  : "whitespace-pre-wrap text-sm leading-relaxed text-[#3B331F]"
              }
            >
              {excerpt}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenPreview(shown)}
          className="self-start text-sm font-semibold text-brand underline-offset-2 hover:underline"
        >
          Guarda come la vedrà chi la riceve
        </button>

        <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Dopo la chiusura non potrai più cambiare la lettera, gli allegati, la data né i destinatari.
          {linked > 0
            ? ` ${linked === 1 ? "Il contenuto collegato verrà copiato" : "I contenuti collegati verranno copiati"} al suo interno: l'originale in Archivio resterà libero di essere modificato o cancellato.`
            : ""}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canClose || busy}
            onClick={() => onConfirm(shown)}
            className={`${BTN_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {busy ? "Chiusura…" : "Chiudi la capsula"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={BTN_SECONDARY}>
            Non ancora
          </button>
          <Link href={`/capsules/${shown.id}/edit`} className="ml-auto text-sm font-semibold text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
            Modifica la bozza
          </Link>
        </div>
      </div>
    </div>
  );
}
