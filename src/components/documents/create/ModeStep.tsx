import {
  MODE_DESCRIPTION,
  MODE_ICON,
  MODE_LABEL,
  type CreationMode,
} from "@/components/documents/create/create-model";

/** Passo 1: che tipo di contenuto aggiungere. */
export function ModeStep({
  mode,
  onSelect,
}: {
  mode: CreationMode | null;
  onSelect: (mode: CreationMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tipo di contenuto"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {(Object.keys(MODE_LABEL) as CreationMode[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => onSelect(option)}
          className={
            mode === option
              ? "flex flex-col items-center gap-1.5 rounded-card border-2 border-brand bg-brand/5 px-4 py-5 text-center"
              : "flex flex-col items-center gap-1.5 rounded-card border border-zinc-200 px-4 py-5 text-center hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
          }
        >
          <span className="text-2xl" aria-hidden="true">
            {MODE_ICON[option]}
          </span>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {MODE_LABEL[option]}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {MODE_DESCRIPTION[option]}
          </span>
        </button>
      ))}
    </div>
  );
}
