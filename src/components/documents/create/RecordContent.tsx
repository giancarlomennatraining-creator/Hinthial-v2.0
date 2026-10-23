import { AudioVideoRecorder } from "@/components/media/AudioVideoRecorder";
import { INPUT_FIELD } from "@/components/ui/styles";

/** Passo 2 per "Registra audio/video": il registratore, la registrazione pronta e il titolo. */
export function RecordContent({
  recordedFile,
  onRecorded,
  title,
  onTitleChange,
}: {
  recordedFile: File | null;
  onRecorded: (file: File) => void;
  title: string;
  onTitleChange: (title: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AudioVideoRecorder
        onRecorded={onRecorded}
        title="Registra un audio o un video"
        description="Resta in memoria finché non salvi il contenuto qui sotto."
        confirmLabel="Usa questa registrazione"
      />
      {recordedFile ? (
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          🎬 Pronta: {recordedFile.name}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label
          htmlFor="record-title"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Titolo
        </label>
        <input
          id="record-title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={
            recordedFile?.name ?? "es. Colloquio col notaio"
          }
          className={`w-full ${INPUT_FIELD}`}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Lascia vuoto per usare il nome della registrazione.
        </p>
      </div>
    </div>
  );
}
