"use client";

import { CAPSULE_TEMPLATES, templateMeta, type CapsuleTemplate } from "@/domain/capsules/templates";

const DETAIL_TITLE = "text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

/**
 * "Parti da un'occasione": le schede dei modelli di capsula (v. domain/capsules/templates.ts), con "Parti da zero" come
 * percorso di sempre, e sotto, per il modello scelto, quando si apre, gli spunti per scrivere e gli allegati che ci stanno bene.
 */
export function CapsuleTemplatePicker({
  selected,
  onPick,
}: {
  selected: CapsuleTemplate | null;
  onPick: (template: CapsuleTemplate | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <section aria-label="Modelli" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {CAPSULE_TEMPLATES.map((item) => {
          const active = selected?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(item)}
              className={`flex flex-col gap-2 rounded-[16px] border-[1.5px] bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 dark:bg-zinc-950 ${
                active
                  ? "border-brand shadow-[0_10px_26px_rgba(43,79,196,0.18)]"
                  : "border-zinc-200 shadow-[0_2px_8px_rgba(18,26,53,0.04)] dark:border-zinc-800"
              }`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: item.tint }} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
              </span>
              <span className="font-heading text-[15px] leading-tight font-extrabold text-zinc-900 dark:text-zinc-100">{item.name}</span>
              <span className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">{item.description}</span>
              <span className="text-[11.5px] font-bold text-zinc-400 dark:text-zinc-500">{templateMeta(item)}</span>
            </button>
          );
        })}
      </section>

      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onPick(null)}
        className={`self-start rounded-xl border-[1.5px] px-3.5 py-2 text-[13px] font-bold ${
          selected === null ? "border-brand bg-zinc-50 text-accent dark:bg-brand/10" : "border-dashed border-zinc-300 text-accent dark:border-zinc-700"
        }`}
      >
        Parti da zero
      </button>

      {selected ? (
        <section
          aria-label="Cosa propone il modello"
          className="grid grid-cols-1 gap-4 rounded-card border border-zinc-200 bg-white p-4 text-sm sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-1">
            <h2 className={DETAIL_TITLE}>Si apre</h2>
            <p className="text-zinc-900 dark:text-zinc-100">{selected.openHint}</p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className={DETAIL_TITLE}>Spunti per scrivere</h2>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-zinc-900 dark:text-zinc-100">
              {selected.prompts.map((prompt) => (
                <li key={prompt}>{prompt}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className={DETAIL_TITLE}>Allegati che ci stanno bene</h2>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-zinc-900 dark:text-zinc-100">
              {selected.attachmentIdeas.map((idea) => (
                <li key={idea}>{idea}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
