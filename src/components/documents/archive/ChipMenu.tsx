"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useDismissOnOutside } from "@/lib/use-dismiss-on-outside";

export interface ChipOption {
  value: string;
  label: string;
}

/**
 * Un filtro a "pillola" con un menu a tendina: mostra il nome del filtro e, se ne è scelto uno, quale. Chi lo usa
 * decide cosa significhi `value` (vuoto = nessun filtro).
 */
export function ChipMenu({
  label,
  options,
  value,
  onChange,
  allLabel,
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  /** Nome della voce che toglie il filtro. */
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDismissOnOutside(ref, open, () => setOpen(false), { escape: true });

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border-[1.5px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors",
          selected
            ? "border-brand bg-brand/10 text-brand"
            : "border-[#dfe3f0] bg-white text-[#121a35] hover:border-brand hover:bg-[#f1f5ff] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100",
        )}
      >
        {label}
        {selected ? <span className="font-bold">: {selected.label}</span> : null}
        <span aria-hidden="true" className="text-[#5b6483] dark:text-zinc-400">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1.5 max-h-72 min-w-48 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {[{ value: "", label: allLabel }, ...options].map((option) => (
            <li key={option.value || "all"}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900",
                  option.value === value ? "font-bold text-brand" : "text-zinc-700 dark:text-zinc-300",
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
