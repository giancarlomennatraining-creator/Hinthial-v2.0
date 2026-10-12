"use client";

import { useEffect, useState } from "react";
import { CapsuleArt } from "@/components/capsules/CapsuleArt";
import { CapsulePorthole } from "@/components/capsules/CapsulePorthole";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { getCapsuleAppearance, updateCapsuleStyle } from "@/domain/profile/repository";
import { CAPSULE_STYLE_OPTIONS, DEFAULT_CAPSULE_STYLE, type CapsuleStyle } from "@/lib/capsule-style";
import { cn } from "@/lib/utils";

/** Una miniatura disegnata con gli stessi pezzi dell'elenco vero: dà l'idea della composizione senza dipendere dai dati dell'utente. */
function StylePreview({ style }: { style: CapsuleStyle }) {
  if (style === "flat") {
    return (
      <div aria-hidden="true" className="grid h-24 grid-cols-2 gap-2">
        {(["sealed", "ready"] as const).map((state) => (
          <div key={state} className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className={cn("flex h-11 items-center justify-center bg-gradient-to-b", state === "ready" ? "from-[#DDF6E8] to-[#C9EFD9] dark:from-[#0f2a1d] dark:to-[#0c2217]" : "from-[#E8EEFC] to-[#DCE5FA] dark:from-[#18213d] dark:to-[#141b33]")}>
              <CapsuleArt variant="flat" state={state} className="w-16 -rotate-6" />
            </div>
            <div className="flex flex-col gap-1 p-1.5">
              <div className="h-1.5 w-3/4 rounded bg-zinc-300 dark:bg-zinc-700" />
              <div className="h-1.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (style === "porthole") {
    return (
      <div aria-hidden="true" className="flex h-24 flex-col gap-1.5">
        {(["sealed", "ready"] as const).map((state) => (
          <div key={state} className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 dark:border-zinc-800 dark:bg-zinc-950">
            <CapsulePorthole state={state} progress={state === "ready" ? 1 : 0.35} className="h-9 w-9" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="h-1.5 w-3/4 rounded bg-zinc-300 dark:bg-zinc-700" />
              <div className="h-1.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="grid h-24 grid-cols-2 gap-2">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="relative h-8 bg-[#e8edfc] dark:bg-brand/15">
            <span className={cn("absolute -bottom-2 left-2 h-4 w-4 rounded-full", i === 0 ? "bg-[#b3302f]" : "bg-[#1c7c5a]")} />
          </div>
          <div className="mt-3 flex flex-col gap-1 p-1.5">
            <div className="h-1.5 w-3/4 rounded bg-zinc-300 dark:bg-zinc-700" />
            <div className="h-1.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Impostazioni -> Aspetto -> Capsule: sceglie lo stile dell'elenco delle capsule (v. lib/capsule-style.ts), con una miniatura e
 * una spiegazione per ognuno. Sincronizzato sul server (profiles.capsule_style): la pagina Capsule lo legge al prossimo caricamento.
 */
export function CapsuleStyleSettings() {
  const supabase = useSupabase();
  const [style, setStyle] = useState<CapsuleStyle>(DEFAULT_CAPSULE_STYLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const appearance = await getCapsuleAppearance(supabase, user.id);
        if (!cancelled) setStyle(appearance.style);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleChange(next: CapsuleStyle) {
    if (next === style) return;
    setError(false);
    const previous = style;
    setStyle(next); // ottimistico: la scheda risponde subito
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await updateCapsuleStyle(supabase, user.id, next);
    } catch {
      setStyle(previous);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Stile delle capsule" className="grid gap-3 sm:grid-cols-3">
        {CAPSULE_STYLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={style === option.value}
            disabled={loading}
            onClick={() => void handleChange(option.value)}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
              style === option.value
                ? "border-brand bg-brand/5 ring-1 ring-brand"
                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
            )}
          >
            <StylePreview style={option.value} />
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span>
            </span>
          </button>
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
