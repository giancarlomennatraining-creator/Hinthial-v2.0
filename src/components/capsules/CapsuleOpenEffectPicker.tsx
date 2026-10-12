"use client";

import { useEffect, useRef, useState } from "react";
import { CapsuleOpenPreview } from "@/components/capsules/opening/CapsuleOpenPreview";
import { EffectIcon } from "@/components/capsules/opening/EffectIcon";
import { originOf } from "@/components/capsules/opening/helpers";
import type { OpenOrigin, OpenedAttachment } from "@/components/capsules/opening/types";
import { OPEN_EFFECT_OPTIONS, type CapsuleOpenEffect } from "@/domain/capsules/open-effects";
import type { CapsuleContentStyle } from "@/domain/capsules/types";
import { useSupabase } from "@/lib/db/supabase/use-supabase";
import { BTN_SECONDARY } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

/**
 * "Come si apre": chi scrive una capsula sceglie con quale effetto la vedrà chi la riceve, una volta disponibile (v.
 * domain/capsules/open-effects.ts). "Prova l'effetto" lo mostra con la lettera e gli allegati di questa capsula, senza inviare
 * né scaricare nulla.
 */
export function CapsuleOpenEffectPicker({
  idPrefix,
  value,
  onChange,
  title,
  letter,
  letterStyle,
  attachments,
}: {
  idPrefix: string;
  value: CapsuleOpenEffect;
  onChange: (next: CapsuleOpenEffect) => void;
  title: string;
  letter: string;
  letterStyle: CapsuleContentStyle;
  attachments: OpenedAttachment[];
}) {
  const supabase = useSupabase();
  const [previewing, setPreviewing] = useState(false);
  const [origin, setOrigin] = useState<OpenOrigin | null>(null);
  const [ownerName, setOwnerName] = useState("Giulia");
  const tryRef = useRef<HTMLButtonElement>(null);

  // Il nome di chi scrive, per la riga "Da ...": best-effort, senza il nome vale un segnaposto.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
        const name = `${data?.first_name ?? ""} ${data?.last_name ?? ""}`.trim();
        if (!cancelled && name) setOwnerName(name);
      } catch {
        // Resta il segnaposto.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Come si apre per chi la riceve</legend>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        È ciò che vedrà chi la riceve quando la capsula sarà disponibile: cambia solo il modo di aprirla, non il contenuto.
      </p>

      <div role="radiogroup" aria-label="Come si apre per chi la riceve" className="grid gap-2 sm:grid-cols-2">
        {OPEN_EFFECT_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              id={`${idPrefix}-effect-${option.value}`}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                selected ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900",
              )}
            >
              <EffectIcon effect={option.value} className={cn("mt-0.5 h-7 w-7 shrink-0", selected ? "text-brand" : "text-zinc-400")} />
              <span>
                <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        ref={tryRef}
        type="button"
        onClick={() => {
          setOrigin(originOf(tryRef.current));
          setPreviewing(true);
        }}
        className={`self-start ${BTN_SECONDARY}`}
      >
        Prova l&apos;effetto
      </button>

      {previewing ? (
        <CapsuleOpenPreview
          effect={value}
          title={title}
          letter={letter}
          letterStyle={letterStyle}
          attachments={attachments}
          ownerName={ownerName}
          origin={origin}
          onClose={() => setPreviewing(false)}
        />
      ) : null}
    </fieldset>
  );
}

/** Gli allegati di una capsula in preparazione, come li mostra l'anteprima di un effetto (solo i nomi). */
export function previewAttachments(
  items: { id?: string; filename: string; mimeType: string; size: number }[],
): OpenedAttachment[] {
  return items.map((item, i) => ({ id: item.id ?? `${item.filename}-${i}`, filename: item.filename, mimeType: item.mimeType, size: item.size }));
}
