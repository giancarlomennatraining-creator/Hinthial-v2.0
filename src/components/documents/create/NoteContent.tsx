import { INPUT_FIELD } from "@/components/ui/styles";

/** Passo 2 per "Scrivi una nota": titolo e testo. */
export function NoteContent({
  noteTitle,
  onNoteTitleChange,
  noteBody,
  onNoteBodyChange,
}: {
  noteTitle: string;
  onNoteTitleChange: (value: string) => void;
  noteBody: string;
  onNoteBodyChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="note-title"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Titolo
        </label>
        <input
          id="note-title"
          type="text"
          value={noteTitle}
          onChange={(e) => onNoteTitleChange(e.target.value)}
          placeholder="es. Combinazione della cassaforte"
          className={INPUT_FIELD}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="note-body"
          className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          Testo
        </label>
        <textarea
          id="note-body"
          rows={6}
          value={noteBody}
          onChange={(e) => onNoteBodyChange(e.target.value)}
          className={INPUT_FIELD}
        />
      </div>
    </div>
  );
}
