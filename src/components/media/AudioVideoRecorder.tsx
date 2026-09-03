"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, recordingFilename } from "@/lib/media-recording";

type Kind = "audio" | "video";

const CANDIDATE_MIME_TYPES: Record<Kind, string[]> = {
  audio: ["audio/webm", "audio/ogg"],
  video: ["video/webm;codecs=vp9,opus", "video/webm"],
};

function pickMimeType(kind: Kind): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return CANDIDATE_MIME_TYPES[kind].find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mimeType: string): string {
  return mimeType.startsWith("video/") ? "webm" : mimeType.includes("ogg") ? "ogg" : "webm";
}

/**
 * Registra un messaggio audio o video dal microfono/videocamera del
 * dispositivo e lo restituisce come File (v. onRecorded) --- da quel
 * momento in poi è un contenuto come un altro per chi la usa (un nuovo
 * elemento d'Archivio, o un allegato diretto di una capsula), stessa
 * cifratura, nessun trattamento speciale lato server. Nulla lascia il
 * browser finché il chiamante non salva: la registrazione resta in
 * memoria come Blob fino a quel punto. Testi personalizzabili perché
 * il contesto cambia cosa succede alla conferma (v. Archivio/Capsule).
 */
export function AudioVideoRecorder({
  onRecorded,
  title = "Messaggio audio o video",
  description = "Registrato dal tuo dispositivo, cifrato come qualsiasi altro contenuto --- nulla lascia il browser finché non salvi.",
  confirmLabel = "Aggiungi",
}: {
  onRecorded: (file: File) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function stopTimer() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // Ferma sempre stream/timer se il componente si smonta a metà registrazione.
  useEffect(() => {
    return () => {
      stopStream();
      stopTimer();
    };
  }, []);

  async function startRecording(nextKind: Kind) {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: nextKind === "video" ? { width: 640, height: 480 } : false,
      });
      streamRef.current = stream;
      if (nextKind === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      chunksRef.current = [];
      const mimeType = pickMimeType(nextKind);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || (nextKind === "video" ? "video/webm" : "audio/webm");
        const blob = new Blob(chunksRef.current, { type });
        const filename = recordingFilename(nextKind, Date.now(), extensionFor(type));
        setPreviewFile(new File([blob], filename, { type }));
        setPreviewUrl(URL.createObjectURL(blob));
        stopStream();
      };

      recorder.start();
      recorderRef.current = recorder;
      setKind(nextKind);
      setRecording(true);
      setElapsedSeconds(0);
      intervalRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        "Impossibile accedere a microfono/videocamera --- controlla i permessi del browser.",
      );
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
    stopTimer();
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setKind(null);
  }

  function confirmAdd() {
    if (previewFile) onRecorded(previewFile);
    discardPreview();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {previewUrl && previewFile ? (
        <div className="flex flex-col gap-3">
          {kind === "video" ? (
            <video src={previewUrl} controls className="max-w-sm rounded-md" />
          ) : (
            <audio src={previewUrl} controls className="w-full max-w-sm" />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmAdd}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
            >
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={discardPreview}
              className="text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Scarta e rifai
            </button>
          </div>
        </div>
      ) : recording ? (
        <div className="flex flex-col gap-3">
          {kind === "video" ? (
            <video ref={videoPreviewRef} autoPlay muted playsInline className="max-w-sm rounded-md" />
          ) : null}
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
              <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              Registrazione · {formatDuration(elapsedSeconds)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Ferma registrazione
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => startRecording("audio")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            🎤 Registra audio
          </button>
          <button
            type="button"
            onClick={() => startRecording("video")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            🎥 Registra video
          </button>
        </div>
      )}
    </div>
  );
}
