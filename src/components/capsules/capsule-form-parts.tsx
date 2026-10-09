"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import { BTN_SECONDARY, INPUT_FIELD } from "@/components/ui/styles";

/**
 * I pezzi che il wizard di creazione (CreateCapsuleForm) e la pagina di modifica (EditCapsuleForm) di una capsula
 * hanno in comune: intestazione, cornice, campo titolo, errore, pulsanti di passo e sezione degli allegati.
 */

export type CapsuleFormStep = 1 | 2 | 3;

export const CAPSULE_STEP_LABEL: Record<CapsuleFormStep, string> = {
  1: "chi e quando",
  2: "contenuti dall'archivio",
  3: "audio, video e testo",
};

export function stepLine(step: CapsuleFormStep): string {
  return `Passo ${step} di 3 — ${CAPSULE_STEP_LABEL[step]}`;
}

export function CapsuleFormHeader({
  title,
  description,
  step,
}: {
  title: string;
  description?: string;
  /** Il passo corrente, o null se non c'è un wizard da mostrare (capsula non trovata o già chiusa). */
  step: CapsuleFormStep | null;
}) {
  return (
    <div>
      <Link
        href="/capsules"
        className="text-sm font-medium text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        ← Torna alle capsule
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brand">{title}</h1>
      {description ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      {step ? <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{stepLine(step)}</p> : null}
    </div>
  );
}

const CARD_CLASS =
  "flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_8px_20px_rgba(16,24,40,0.04)] p-4 dark:border-zinc-800 dark:bg-zinc-950";

/** La cornice dei passi: un `<form>` se serve l'invio (creazione), altrimenti un semplice contenitore. */
export function CapsuleFormCard({
  onSubmit,
  children,
}: {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return onSubmit ? (
    <form onSubmit={onSubmit} className={CARD_CLASS}>
      {children}
    </form>
  ) : (
    <div className={CARD_CLASS}>{children}</div>
  );
}

export function CapsuleTitleField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Titolo
      </label>
      <input
        id="title"
        type="text"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_FIELD}
      />
    </div>
  );
}

export function StepError({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null;
}

/** I pulsanti in fondo a un passo: "Indietro" (se non è il primo), il pulsante del passo (`children`) e "Annulla". */
export function StepNav({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className={`self-start ${BTN_SECONDARY}`}>
          Indietro
        </button>
      ) : null}
      {children}
      <Link href="/capsules" className={`self-start ${BTN_SECONDARY}`}>
        Annulla
      </Link>
    </div>
  );
}

/** Un allegato scelto, con il pulsante per toglierlo. */
export function AttachmentChip({ label, name, onRemove }: { label: ReactNode; name: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-3 pr-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Rimuovi ${name}`}
        className="rounded-full px-1.5 py-0.5 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        ✕
      </button>
    </span>
  );
}

/** I file audio/video appena aggiunti (registrati o caricati), ognuno rimovibile. */
export function NewFileChips({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return (
    <>
      {files.map((file, i) => (
        <AttachmentChip
          key={`${file.name}-${i}`}
          label={
            <>
              {file.type.startsWith("video/") ? "🎥" : "🎤"} {file.name}
            </>
          }
          name={file.name}
          onRemove={() => onRemove(i)}
        />
      ))}
    </>
  );
}

/**
 * Allegati audio/video di una capsula: un'aggiunta secondaria e discreta, non un passo alla pari con scrivere il
 * messaggio. `chips` sono gli allegati già scelti; il pannello (registratore e caricamento di un file pronto) si apre
 * con "Aggiungi un allegato".
 */
export function AttachmentSection({
  showTools,
  onToggleTools,
  onAddFiles,
  chips,
}: {
  showTools: boolean;
  onToggleTools: () => void;
  onAddFiles: (files: File[]) => void;
  chips: ReactNode;
}) {
  function handleMediaFileChange(event: ChangeEvent<HTMLInputElement>) {
    // "accept" non impone davvero la scelta: si scartano in silenzio i file che non sono audio/video.
    const picked = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith("audio/") || file.type.startsWith("video/"),
    );
    if (picked.length > 0) onAddFiles(picked);
    event.target.value = "";
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleTools}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Aggiungi un allegato
        </button>
        {chips}
      </div>

      {showTools ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <AudioVideoRecorder onRecorded={(file) => onAddFiles([file])} confirmLabel="Aggiungi alla capsula" />

          <div className="flex flex-col gap-1">
            <label htmlFor="mediaFiles" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              ...o carica un audio/video già pronto (opzionale)
            </label>
            <input
              id="mediaFiles"
              type="file"
              accept="audio/*,video/*"
              multiple
              onChange={handleMediaFileChange}
              className="text-sm text-zinc-700 dark:text-zinc-300"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
