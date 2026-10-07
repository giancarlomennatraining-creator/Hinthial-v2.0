"use client";

import { useEffect, useRef, useState } from "react";
import { bytesToUtf8, decryptBytes, importKeyRaw, parseEnvelope } from "@/lib/crypto";
import { CONTENT_KIND_ICON, CONTENT_KIND_LABEL, contentKindFor, NOTE_MIME_TYPE } from "@/lib/content-kind";
import { saveBytesAsFile } from "@/lib/download";
import { formatDate, formatSize } from "@/lib/format";
import { phaseState } from "@/domain/dossiers/phases";
import { fragmentFromHash, fragmentToKeyBytes, parseManifest, type ShareManifest, type ShareManifestDocument } from "@/domain/dossiers/sharing";

/**
 * Il fascicolo condiviso, visto da chi riceve il link: nessun account. La chiave sta nel link dopo il #, che il browser non
 * invia mai al server: la pagina scarica byte cifrati e li apre qui, sul dispositivo. Chi non ha il link intero non vede
 * niente, nemmeno noi.
 */

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; manifest: ShareManifest; allowDownload: boolean; expiresAt: string };

interface OpenDocument {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  /** Per PDF, immagini, audio e video: un indirizzo locale al contenuto già decifrato. */
  url: string | null;
  text: string | null;
}

const INCOMPLETE_LINK = "Il link è incompleto: manca la chiave per aprire i documenti. Chiedi a chi te l'ha inviato di mandarlo di nuovo, per intero.";

export function SharedDossierView({ shareId }: { shareId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [opened, setOpened] = useState<OpenDocument | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const openedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const keyBytes = fragmentToKeyBytes(fragmentFromHash(window.location.hash));
      if (!keyBytes) {
        setState({ status: "error", message: INCOMPLETE_LINK });
        return;
      }
      try {
        const response = await fetch(`/api/shares/${shareId}`);
        const body = (await response.json().catch(() => null)) as
          | { encryptedManifest?: string; allowDownload?: boolean; expiresAt?: string; error?: string }
          | null;
        if (!response.ok || !body?.encryptedManifest || typeof body.expiresAt !== "string") {
          if (!cancelled) setState({ status: "error", message: body?.error ?? "Impossibile aprire il link." });
          return;
        }
        const key = await importKeyRaw(keyBytes);
        const manifest = parseManifest(bytesToUtf8(await decryptBytes(key, parseEnvelope(body.encryptedManifest))));
        if (!manifest) throw new Error("manifest");
        keyRef.current = key;
        if (!cancelled) setState({ status: "ready", manifest, allowDownload: body.allowDownload === true, expiresAt: body.expiresAt });
      } catch {
        // Una chiave sbagliata o un link modificato non si decifrano: lo si dice senza dettagli tecnici.
        if (!cancelled) setState({ status: "error", message: "Il link non è completo o è stato modificato: non riesco ad aprirlo." });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  useEffect(
    () => () => {
      if (openedUrlRef.current) URL.revokeObjectURL(openedUrlRef.current);
    },
    [],
  );

  function closeDocument() {
    if (openedUrlRef.current) URL.revokeObjectURL(openedUrlRef.current);
    openedUrlRef.current = null;
    setOpened(null);
  }

  /** Scarica la copia cifrata, la decifra qui con la chiave del link, e (se si apre) la mostra. */
  async function fetchDocument(doc: ShareManifestDocument): Promise<Uint8Array | null> {
    const key = keyRef.current;
    if (!key) return null;
    setBusyId(doc.id);
    setDocumentError(null);
    try {
      const response = await fetch(`/api/shares/${shareId}/documents/${doc.id}`);
      if (!response.ok) throw new Error("fetch");
      return await decryptBytes(key, parseEnvelope(await response.text()));
    } catch {
      setDocumentError(`Non riesco ad aprire "${doc.name}": il link potrebbe essere scaduto o revocato.`);
      return null;
    } finally {
      setBusyId(null);
    }
  }

  async function handleOpen(doc: ShareManifestDocument) {
    const bytes = await fetchDocument(doc);
    if (!bytes) return;
    const kind = contentKindFor(doc.mimeType);
    const inlineUrl =
      doc.mimeType === "application/pdf" || kind === "image" || kind === "audio" || kind === "video"
        ? URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: doc.mimeType }))
        : null;
    if (openedUrlRef.current) URL.revokeObjectURL(openedUrlRef.current);
    openedUrlRef.current = inlineUrl;
    setOpened({
      name: doc.name,
      mimeType: doc.mimeType,
      bytes,
      url: inlineUrl,
      text: kind === "note" || doc.mimeType.startsWith("text/") ? bytesToUtf8(bytes) : null,
    });
  }

  async function handleDownload(doc: ShareManifestDocument) {
    const bytes = await fetchDocument(doc);
    if (bytes) saveBytesAsFile(bytes, doc.name, doc.mimeType);
  }

  if (state.status === "loading") {
    return <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Apro il fascicolo…</p>;
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950">
        <h1 className="font-heading text-lg font-extrabold text-red-700 dark:text-red-300">Non posso aprire questo fascicolo</h1>
        <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>
      </div>
    );
  }

  const { manifest, allowDownload, expiresAt } = state;
  const sortedDocuments = [...manifest.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-6 text-[#121a35] dark:text-zinc-100">
      <header className="flex flex-col gap-2">
        <p className="text-[13px] font-bold text-brand">
          {manifest.sharedBy ? `${manifest.sharedBy} ha condiviso con te questo fascicolo` : "Questo fascicolo è stato condiviso con te"}
        </p>
        <h1 className="font-heading text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-brand">{manifest.title}</h1>
        {manifest.description ? <p className="max-w-3xl text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{manifest.description}</p> : null}
        <p className="text-[13px] text-[#5b6483] dark:text-zinc-400">
          {manifest.documents.length} {manifest.documents.length === 1 ? "documento" : "documenti"} · condiviso il {formatDate(manifest.sharedAt)} · il link vale
          fino al {formatDate(expiresAt)}
          {allowDownload ? " · puoi scaricare i documenti" : " · solo lettura"}
        </p>
      </header>

      {manifest.phase ? (
        <section aria-label="Fasi" className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-extrabold">Fase: {manifest.phase.names[manifest.phase.current]}</h2>
          <ol className="flex flex-wrap gap-2">
            {manifest.phase.names.map((name, index) => {
              const phaseStateValue = phaseState(manifest.phase!, index);
              return (
                <li
                  key={`${index}-${name}`}
                  aria-current={phaseStateValue === "current" ? "step" : undefined}
                  className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold ${
                    phaseStateValue === "current"
                      ? "border-brand bg-brand text-white"
                      : phaseStateValue === "done"
                        ? "border-[#bfe3d2] bg-[#e3f4ec] text-[#1c7c5a]"
                        : "border-[#dfe3f0] bg-white text-[#5b6483] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                  }`}
                >
                  {name}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      {manifest.summary ? (
        <section aria-label="In breve" className="flex flex-col gap-2 rounded-[18px] border border-[#cdd8fa] bg-[#f3f6ff] px-5 py-4 dark:border-brand/40 dark:bg-brand/10">
          <h2 className="font-heading text-base font-extrabold">In breve</h2>
          <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap text-[#2c3557] dark:text-zinc-200">{manifest.summary}</p>
        </section>
      ) : null}

      <section aria-label="Documenti" className="flex flex-col gap-3 rounded-[18px] border border-[#dfe3f0] bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="font-heading text-base font-extrabold">Documenti</h2>
        {documentError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {documentError}
          </p>
        ) : null}
        <ul className="flex flex-col">
          {sortedDocuments.map((doc) => {
            const kind = contentKindFor(doc.mimeType);
            return (
              <li key={doc.id} className="flex items-center gap-3 border-t border-[#eef0f8] py-3 first:border-t-0 first:pt-0 dark:border-zinc-900">
                <span className="text-xl" aria-hidden="true">
                  {CONTENT_KIND_ICON[kind]}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[14.5px] font-bold break-words">{doc.name}</span>
                  <span className="text-xs text-[#5b6483] dark:text-zinc-400">
                    {CONTENT_KIND_LABEL[kind]} · {doc.mimeType === NOTE_MIME_TYPE ? "nota" : formatSize(doc.size)} · {formatDate(doc.createdAt)}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busyId === doc.id}
                  onClick={() => void handleOpen(doc)}
                  aria-label={`Apri ${doc.name}`}
                  className="shrink-0 rounded-[10px] border border-[#c9d0e6] bg-white px-3 py-1.5 text-[13px] font-bold text-brand hover:border-brand disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {busyId === doc.id ? "Apro…" : "Apri"}
                </button>
                {allowDownload ? (
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void handleDownload(doc)}
                    aria-label={`Scarica ${doc.name}`}
                    className="shrink-0 rounded-[10px] bg-brand px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    Scarica
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-center text-xs text-[#8a91ad] dark:text-zinc-500">
        I documenti sono cifrati con la chiave contenuta nel link: Hinthial non può leggerli, e questa pagina li apre solo sul tuo dispositivo.
      </p>

      {opened ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={opened.name}
          className="fixed inset-0 z-50 flex flex-col gap-3 bg-black/70 p-4 sm:p-8"
        >
          <div className="flex items-center justify-between gap-3 text-white">
            <p className="min-w-0 truncate text-sm font-bold">{opened.name}</p>
            <button
              type="button"
              onClick={closeDocument}
              className="shrink-0 rounded-[10px] bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#121a35] hover:bg-zinc-100"
            >
              Chiudi
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl bg-white dark:bg-zinc-900">
            {opened.text !== null ? (
              <pre className="max-h-full w-full self-start overflow-auto p-5 text-sm whitespace-pre-wrap">{opened.text}</pre>
            ) : opened.url && opened.mimeType === "application/pdf" ? (
              <iframe src={opened.url} title={opened.name} className="h-full w-full" />
            ) : opened.url && opened.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- contenuto dell'utente già decifrato in memoria (blob), non un asset del sito
              <img src={opened.url} alt={opened.name} className="max-h-full max-w-full object-contain" />
            ) : opened.url && opened.mimeType.startsWith("audio/") ? (
              <audio src={opened.url} controls className="w-full max-w-lg p-6" />
            ) : opened.url && opened.mimeType.startsWith("video/") ? (
              <video src={opened.url} controls className="max-h-full max-w-full" />
            ) : (
              <p className="p-6 text-center text-sm text-[#5b6483]">
                Questo tipo di file non ha un&apos;anteprima.{" "}
                {allowDownload ? "Puoi scaricarlo dalla lista." : "Chi ha condiviso il fascicolo non ha permesso di scaricarlo."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
