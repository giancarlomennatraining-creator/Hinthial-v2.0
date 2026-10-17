"use client";

/**
 * La regola "aprila anche prima, se non ci sono più": accanto alla data, perché è l'altra metà della stessa domanda
 * ("quando si apre?"). Spenta, la capsula si apre solo alla data scelta, qualunque cosa succeda. Accesa, si apre alla
 * data oppure, se arriva prima, quando l'Eredità digitale arriva alla consegna (v. pagina Eredità digitale).
 */
export function CapsuleLegacyField({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-accent focus:ring-brand dark:border-zinc-700"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-zinc-900 dark:text-zinc-100">Aprila anche prima, se non ci sono più</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {checked
            ? "Si apre alla data scelta o, se arriva prima, quando l'Eredità digitale consegna le capsule."
            : "Si apre solo alla data scelta, qualunque cosa succeda."}
        </span>
      </span>
    </label>
  );
}
