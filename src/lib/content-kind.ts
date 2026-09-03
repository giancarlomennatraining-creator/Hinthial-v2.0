/**
 * FASE 14 --- "Archivio" (ex "Documenti") accetta più tipi di contenuto:
 * documento, immagine, audio, video, nota testuale. Tutti vivono nella
 * stessa tabella/cifratura (v. domain/documents) --- questo modulo è
 * l'unico punto che decide, dal mimeType, come un contenuto va mostrato
 * (icona, se ha un player inline, ...). Condiviso tra Archivio e gli
 * allegati delle capsule, che sono lo stesso genere di contenuto.
 */

export type ContentKind = "note" | "image" | "audio" | "video" | "document";

/**
 * mimeType riservato alle note testuali create nell'Archivio (v.
 * domain/documents/repository.ts, createTextNote) --- il "contenuto" è
 * il testo stesso, cifrato esattamente come i byte di un file
 * qualunque. Un normale file .txt caricato dall'utente resta
 * "text/plain" e NON diventa automaticamente una nota modificabile:
 * solo ciò che nasce da "Scrivi una nota" ha questo mimeType.
 */
export const NOTE_MIME_TYPE = "text/x-hinthial-note";

export function contentKindFor(mimeType: string): ContentKind {
  if (mimeType === NOTE_MIME_TYPE) return "note";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

export const CONTENT_KIND_ICON: Record<ContentKind, string> = {
  note: "📝",
  image: "🖼️",
  audio: "🎤",
  video: "🎥",
  document: "📄",
};

export const CONTENT_KIND_LABEL: Record<ContentKind, string> = {
  note: "Nota",
  image: "Immagine",
  audio: "Audio",
  video: "Video",
  document: "Documento",
};

/** Immagini/audio/video hanno un player inline nella lista (v. ContentPlayer); documenti e note no --- una nota si apre/modifica in pagina, un documento si scarica. */
export function hasInlinePlayer(kind: ContentKind): boolean {
  return kind === "image" || kind === "audio" || kind === "video";
}

/** Solo audio/video hanno senso da trascrivere (v. domain/transcription) --- non un'immagine o un documento. */
export function isTranscribable(kind: ContentKind): boolean {
  return kind === "audio" || kind === "video";
}
