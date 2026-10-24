export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-1 rounded-full bg-brand/10 py-1 pr-1 pl-3 text-xs font-medium text-accent">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Rimuovi filtro: ${label}`}
        className="rounded-full px-1.5 py-0.5 hover:bg-brand/20"
      >
        ✕
      </button>
    </li>
  );
}
