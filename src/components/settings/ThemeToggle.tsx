"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { applyTheme, getStoredThemePreference, storeThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
];

/** Impostazioni -> Aspetto. Il tema effettivo (v. lib/theme.ts) è già applicato prima del primo paint da uno script inline; qui solo si riflette e si cambia la preferenza salvata. */
export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legge una preferenza già decisa altrove (localStorage), non deriva stato da props/state React.
    setPreference(getStoredThemePreference());
  }, []);

  useEffect(() => {
    // In modalità "sistema", segue un cambio del tema del sistema operativo mentre l'app resta aperta.
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      applyTheme("system");
    }
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  function handleChange(next: ThemePreference) {
    setPreference(next);
    storeThemePreference(next);
    applyTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex rounded-md border border-zinc-300 p-1 dark:border-zinc-700"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          onClick={() => handleChange(option.value)}
          className={cn(
            "rounded px-3 py-1.5 text-sm font-medium transition-colors",
            preference === option.value
              ? "bg-brand text-white"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
