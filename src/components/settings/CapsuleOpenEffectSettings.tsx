"use client";

import { useEffect, useRef, useState } from "react";
import { CapsuleOpenPreview, SAMPLE_OPEN_PREVIEW } from "@/components/capsules/opening/CapsuleOpenPreview";
import { EffectIcon } from "@/components/capsules/opening/EffectIcon";
import { originOf } from "@/components/capsules/opening/helpers";
import type { OpenOrigin } from "@/components/capsules/opening/types";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { getCapsuleAppearance, updateCapsuleOpenEffect } from "@/domain/profile/repository";
import { DEFAULT_OPEN_EFFECT, OPEN_EFFECT_OPTIONS, type CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import { cn } from "@/lib/utils";
import { ErrorText } from "@/components/ui/ErrorText";

/**
 * Impostazioni -> Aspetto -> Capsule: l'effetto di apertura che si propone per default a chi crea una capsula (v.
 * domain/capsules/open-effects.ts). Ogni capsula può poi avere un effetto diverso, scelto da chi la scrive. "Provalo" mostra
 * l'effetto con una capsula di esempio: nulla si apre davvero.
 */
export function CapsuleOpenEffectSettings() {
  const supabase = useSupabase();
  const [effect, setEffect] = useState<CapsuleOpenEffect>(DEFAULT_OPEN_EFFECT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [previewing, setPreviewing] = useState<CapsuleOpenEffect | null>(null);
  const [origin, setOrigin] = useState<OpenOrigin | null>(null);
  const buttons = useRef<Partial<Record<CapsuleOpenEffect, HTMLButtonElement | null>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const appearance = await getCapsuleAppearance(supabase, user.id);
        if (!cancelled) setEffect(appearance.openEffect);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleChange(next: CapsuleOpenEffect) {
    if (next === effect) return;
    setError(false);
    const previous = effect;
    setEffect(next);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Devi essere autenticato.");
      await updateCapsuleOpenEffect(supabase, user.id, next);
    } catch {
      setEffect(previous);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Effetto di apertura predefinito" className="grid gap-3 sm:grid-cols-2">
        {OPEN_EFFECT_OPTIONS.map((option) => {
          const selected = effect === option.value;
          return (
            <div
              key={option.value}
              className={cn(
                "flex flex-col gap-2 rounded-card border p-4 transition-colors",
                selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={loading}
                onClick={() => void handleChange(option.value)}
                className="flex items-start gap-3 text-left disabled:opacity-60"
              >
                <EffectIcon effect={option.value} className={cn("mt-0.5 h-8 w-8 shrink-0", selected ? "text-accent" : "text-zinc-500")} />
                <span>
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span>
                </span>
              </button>
              <button
                ref={(el) => {
                  buttons.current[option.value] = el;
                }}
                type="button"
                onClick={() => {
                  setOrigin(originOf(buttons.current[option.value] ?? null));
                  setPreviewing(option.value);
                }}
                aria-label={`Provalo: ${option.label}`}
                className="w-fit self-start rounded-lg border border-zinc-200 px-3 py-1 text-xs font-semibold text-accent hover:bg-brand/5 dark:border-zinc-800"
              >
                Provalo
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Lo propongo quando crei una capsula: per ognuna puoi scegliere un effetto diverso. Chi la riceve vede quello che hai scelto tu.
      </p>
      {error ? (
        <ErrorText size="xs">
          Preferenza non salvata.
        </ErrorText>
      ) : null}

      {previewing ? (
        <CapsuleOpenPreview
          effect={previewing}
          title={SAMPLE_OPEN_PREVIEW.title}
          letter={SAMPLE_OPEN_PREVIEW.letter}
          letterStyle={SAMPLE_OPEN_PREVIEW.letterStyle}
          attachments={SAMPLE_OPEN_PREVIEW.attachments}
          origin={origin}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
