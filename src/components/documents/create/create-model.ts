export type CreationMode = "upload" | "record" | "note";

/** FASE 19b: stato della lettura --- "skipped" (tipo non leggibile) è diverso da "done" senza risultato. */
export type ReadingState =
  | { status: "idle" }
  | { status: "reading"; progress: number | null }
  | { status: "skipped" }
  | { status: "done"; text: string | null };

/**
 * Un file scelto. Uno o molti, il percorso è lo stesso: ognuno ha il suo stato di lettura e, se i file sono più d'uno, il
 * suo titolo.
 */
export interface LotFile {
  id: string;
  file: File;
  title: string;
  reading: ReadingState;
}

export const MODE_LABEL: Record<CreationMode, string> = {
  upload: "Carica un file",
  record: "Registra audio/video",
  note: "Scrivi una nota",
};

export const MODE_ICON: Record<CreationMode, string> = {
  upload: "📄",
  record: "🎬",
  note: "📝",
};

export const MODE_DESCRIPTION: Record<CreationMode, string> = {
  upload: "uno o più file: bollette, contratti, referti",
  record: "audio o video",
  note: "testo scritto ora",
};

/** Il titolo scelto per una registrazione, con l'estensione del file: senza, il sistema operativo non saprebbe più con cosa aprirlo. */
export function recordingTitle(title: string, filename: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return undefined;
  const extension = filename.includes(".")
    ? filename.slice(filename.lastIndexOf("."))
    : "";
  return trimmed.toLowerCase().endsWith(extension.toLowerCase())
    ? trimmed
    : `${trimmed}${extension}`;
}
