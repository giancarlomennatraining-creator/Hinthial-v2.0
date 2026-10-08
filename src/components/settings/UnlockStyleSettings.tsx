"use client";

import { useState } from "react";
import { useUnlockPrompt } from "@/components/crypto/UnlockPromptProvider";
import { UNLOCK_STYLE_OPTIONS, type UnlockStyle } from "@/lib/unlock-style";
import { cn } from "@/lib/utils";

/** Una miniatura disegnata con forme semplici: dà l'idea della pelle senza dipendere da nulla. */
function StylePreview({ style }: { style: UnlockStyle }) {
  if (style === "vault") {
    return (
      <div aria-hidden="true" className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900">
        <div className="grid size-16 place-items-center rounded-full border-4 border-slate-500 bg-slate-600">
          <div className="grid size-9 place-items-center rounded-full border-2 border-indigo-300 bg-indigo-950">
            <div className="h-0.5 w-5 bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }
  if (style === "fingerprint") {
    return (
      <div aria-hidden="true" className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-800">
        <div className="grid size-16 place-items-center rounded-full border-2 border-indigo-300/70 bg-indigo-400/20">
          <svg viewBox="0 0 24 24" className="size-8 fill-none stroke-white" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 3a8 8 0 0 0-8 8v1M12 3a8 8 0 0 1 8 8v3M7.5 20c.5-1.6.9-3 .9-5a3.6 3.6 0 0 1 7.2 0c0 2.5.3 4.2 1.2 6" />
          </svg>
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-700">
      <div className="flex w-20 flex-col items-center gap-1.5 rounded-2xl border border-white/50 bg-gradient-to-br from-fuchsia-200/80 to-sky-200/80 p-2">
        <div className="h-4 w-4 rounded-t-full border-2 border-b-0 border-brand" />
        <div className="-mt-1.5 h-4 w-6 rounded-md bg-brand" />
        <div className="h-2 w-full rounded-full bg-white" />
      </div>
    </div>
  );
}

/**
 * Impostazioni -> Aspetto -> Sblocco: sceglie come si presenta la finestra di sblocco della master key, con una breve
 * spiegazione per ogni pelle e un pulsante per provarla (un'anteprima che non sblocca nulla). La scelta segue l'account
 * su ogni dispositivo.
 */
export function UnlockStyleSettings() {
  const { style, setStyle, preview } = useUnlockPrompt();
  const [error, setError] = useState(false);

  async function handleChange(next: UnlockStyle) {
    if (next === style) return;
    setError(false);
    try {
      await setStyle(next);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Stile della finestra di sblocco" className="grid gap-3 sm:grid-cols-3">
        {UNLOCK_STYLE_OPTIONS.map((option) => (
          <div
            key={option.value}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
              style === option.value
                ? "border-brand bg-brand/5 ring-1 ring-brand"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={style === option.value}
              onClick={() => void handleChange(option.value)}
              className="flex flex-1 flex-col gap-3 text-left"
            >
              <StylePreview style={option.value} />
              <span>
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => preview(option.value)}
              aria-label={`Prova lo stile ${option.label}`}
              className="self-start rounded-xl border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Provala
            </button>
          </div>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Preferenza non salvata.
        </p>
      ) : null}
    </div>
  );
}
