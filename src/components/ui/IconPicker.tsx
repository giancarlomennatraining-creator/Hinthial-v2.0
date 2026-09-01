"use client";

import { useEffect, useRef, useState } from "react";

/** Curated set --- not exhaustive, just a practical starting point for category icons. */
const ICON_CHOICES = [
  "👤", "🏠", "🚗", "🛡️", "📄", "💰", "❤️", "📊", "🔑", "📦",
  "🎯", "📚", "💼", "🎨", "✈️", "🏥", "🎓", "🐾", "🌿", "🎵",
  "📱", "💻", "🛒", "🍽️", "🏖️", "⚽", "🎁", "🔧", "📷", "🏦",
  "⚖️", "🎭", "🌟", "🧾", "🏢", "🚲", "⛵", "👶", "💍", "🎉",
  "🧳", "🛠️", "🌍", "📅", "🔒", "💳", "🏆", "🖥️",
];

/**
 * A text input for a single emoji, with a dropdown grid of common
 * choices shown on focus/click --- still directly typable, the grid is
 * just a shortcut so the user doesn't have to reach for a system emoji
 * picker.
 */
export function IconPicker({
  id,
  name,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        maxLength={4}
        autoComplete="off"
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-center text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />

      {open ? (
        <div
          role="listbox"
          aria-label="Icone disponibili"
          className="absolute left-0 top-full z-10 mt-1 grid w-64 grid-cols-8 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {ICON_CHOICES.map((icon) => (
            <button
              key={icon}
              type="button"
              role="option"
              aria-selected={value === icon}
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {icon}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
