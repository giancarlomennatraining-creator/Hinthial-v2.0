"use client";

import type { CapsuleContentStyle } from "@/domain/capsules/types";

const TOGGLE_OPTIONS: { value: CapsuleContentStyle; label: string }[] = [
  { value: "simple", label: "Scrittura semplice" },
  { value: "handwritten", label: "A mano" },
];

/**
 * La superficie di scrittura del messaggio --- una vera "carta" calda,
 * non un textarea grigia uguale a ogni altro campo (v. richiesta
 * utente, "capsule come lettere"). "A mano" passa il testo a Caveat
 * (v. layout.tsx): una scelta di chi scrive, salvata con la capsula
 * (v. CapsuleContentStyle) così chi la riceve la vede come l'ha
 * lasciata, mai imposta di default.
 */
export function CapsuleLetterEditor({
  id,
  content,
  onContentChange,
  contentStyle,
  onContentStyleChange,
  placeholder,
}: {
  id: string;
  content: string;
  onContentChange: (next: string) => void;
  contentStyle: CapsuleContentStyle;
  onContentStyleChange: (next: CapsuleContentStyle) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-1 min-h-[220px] flex-col overflow-hidden rounded-2xl border border-[#EDE1C4] bg-[#FBF6EA] shadow-[0_10px_26px_rgba(139,111,45,0.10)]">
      <div className="flex items-center justify-between px-8 pt-5">
        <label
          htmlFor={id}
          className="text-xs font-bold uppercase tracking-wide text-[#6B5730]"
        >
          Il tuo messaggio
        </label>
        <div
          role="radiogroup"
          aria-label="Stile del testo"
          className="flex items-center gap-0.5 rounded-full bg-[#F1E7CC] p-0.5"
        >
          {TOGGLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={contentStyle === option.value}
              onClick={() => onContentStyleChange(option.value)}
              className={
                contentStyle === option.value
                  ? "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-[#3B331F] shadow-sm"
                  : "rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#6B5730]"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <textarea
        id={id}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder={placeholder}
        className={
          contentStyle === "handwritten"
            ? "flex-1 resize-none bg-transparent px-8 pb-8 pt-3 text-[26px] leading-relaxed text-[#3B331F] placeholder:text-[#B3A374] focus:outline-none font-caveat"
            : "flex-1 resize-none bg-transparent px-8 pb-8 pt-3 text-[17px] leading-relaxed text-[#3B331F] placeholder:text-[#B3A374] focus:outline-none"
        }
      />
    </div>
  );
}
