"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/db/supabase/client";
import { getDashboardStyle, updateDashboardStyle } from "@/domain/profile/repository";
import {
  DASHBOARD_STYLE_OPTIONS,
  DEFAULT_DASHBOARD_STYLE,
  type DashboardStyle,
} from "@/lib/dashboard-style";
import { cn } from "@/lib/utils";

/** Una miniatura disegnata con div: dà l'idea della composizione senza dipendere dai dati dell'utente. */
function StylePreview({ style }: { style: DashboardStyle }) {
  const block = "rounded bg-zinc-200 dark:bg-zinc-800";
  const accent = "rounded bg-brand/70";
  if (style === "today") {
    return (
      <div aria-hidden="true" className="flex h-20 gap-1.5">
        <div className="flex flex-1 flex-col gap-1">
          <div className="h-7 rounded bg-brand" />
          <div className={cn("h-3.5", block)} />
          <div className={cn("h-3.5", block)} />
        </div>
        <div className="flex w-1/3 flex-col gap-1">
          <div className={cn("h-6", block)} />
          <div className={cn("flex-1", block)} />
        </div>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="flex h-20 flex-col gap-1.5">
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("h-5", i === 0 ? accent : block)} />
        ))}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={block} />
        ))}
      </div>
    </div>
  );
}

/**
 * Impostazioni -> Aspetto -> Dashboard: sceglie lo stile della Dashboard (v. lib/dashboard-style.ts), con una breve
 * spiegazione per ognuno. Sincronizzato sul server: la Dashboard lo legge al prossimo caricamento della pagina.
 */
export function DashboardStyleSettings() {
  const [supabase] = useState(() => createClient());
  const [style, setStyle] = useState<DashboardStyle>(DEFAULT_DASHBOARD_STYLE);
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
        const result = await getDashboardStyle(supabase, user.id);
        if (!cancelled) setStyle(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleChange(next: DashboardStyle) {
    if (next === style) return;
    setError(false);
    const previous = style;
    setStyle(next); // ottimistico: la scheda risponde subito
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await updateDashboardStyle(supabase, user.id, next);
    } catch {
      setStyle(previous);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Stile della Dashboard"
        className="grid gap-3 sm:grid-cols-2"
      >
        {DASHBOARD_STYLE_OPTIONS.map((option) => (
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
