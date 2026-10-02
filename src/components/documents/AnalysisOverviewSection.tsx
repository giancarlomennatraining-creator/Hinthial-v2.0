"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prepareAnalysis } from "@/domain/ai/analysis/blocks";
import type { AnalysisOverview, OverviewFact } from "@/domain/ai/analysis/overview";
import { splitAroundQuote } from "@/domain/ai/analysis/source";
import type { ContentSegment } from "@/domain/extraction/types";
import { formatDate } from "@/lib/format";

/**
 * "Cosa ha letto Hinthia": il tipo del documento e i dati ricavati, ognuno con da dove viene (la pagina) e la frase
 * del documento che lo prova. Mai il JSON della lettura: solo righe leggibili. Un dato "Nella Scheda" è tuo (l'hai
 * accettato o scritto); uno "Letto da Hinthia" è ancora solo una lettura, da rivedere tra le proposte. La pagina si
 * apre sul testo letto, con la frase evidenziata.
 */

function displayValue(fact: OverviewFact): string {
  return fact.valueType === "date" ? formatDate(fact.value) : fact.value;
}

function sourceLabel(fact: OverviewFact): string {
  return fact.provenance.page !== null ? `pagina ${fact.provenance.page}` : "nel testo";
}

function adoptedLabel(fact: OverviewFact): string {
  return fact.kind === "event" ? "In Scadenze" : "Nella Scheda";
}

/** Il testo del punto d'origine, evidenziato sulla frase che prova il dato. */
function SourceExcerptView({ text, quote }: { text: string; quote: string }) {
  const excerpt = splitAroundQuote(text, quote);
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    markRef.current?.scrollIntoView?.({ block: "center" });
  }, []);

  return (
    <div
      role="region"
      aria-label="Testo letto"
      className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs whitespace-pre-wrap text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    >
      {excerpt ? (
        <>
          {excerpt.before}
          <mark ref={markRef} className="rounded bg-brand/20 px-0.5 text-inherit">
            {excerpt.match}
          </mark>
          {excerpt.after}
        </>
      ) : (
        text
      )}
    </div>
  );
}

export function AnalysisOverviewSection({
  overview,
  segments,
  text,
}: {
  overview: AnalysisOverview;
  /** Le pagine lette (null per un documento letto prima delle pagine: allora si usano le sezioni del testo). */
  segments: ContentSegment[] | null;
  text: string;
}) {
  const { coverage } = overview;
  const [openFactId, setOpenFactId] = useState<string | null>(null);
  // Gli stessi segmenti su cui la lettura è stata fatta: l'id della provenienza (p3, s5...) si ritrova qui.
  const sourceText = useMemo(() => {
    const byId = new Map<string, string>();
    for (const segment of prepareAnalysis({ segments, text }).segments) byId.set(segment.id, segment.text);
    return byId;
  }, [segments, text]);

  return (
    <section
      aria-label="Cosa ha letto Hinthia"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cosa ha letto Hinthia</h2>

      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">Tipo di documento</span>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{overview.typeLabel}</span>
        {overview.typeRecognized ? null : (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">non rientra in un tipo noto</span>
        )}
      </p>

      {overview.facts.length > 0 ? (
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
          {overview.facts.map((fact) => (
            <li key={fact.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{fact.label}</span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{displayValue(fact)}</span>
                <span
                  className={
                    fact.adopted
                      ? "rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                  }
                >
                  {fact.adopted ? adoptedLabel(fact) : "Letto da Hinthia"}
                </span>
                {sourceText.has(fact.provenance.segmentId) ? (
                  <button
                    type="button"
                    aria-expanded={openFactId === fact.id}
                    onClick={() => setOpenFactId(openFactId === fact.id ? null : fact.id)}
                    className="text-xs text-brand underline-offset-2 hover:underline"
                  >
                    {sourceLabel(fact)}
                  </button>
                ) : (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{sourceLabel(fact)}</span>
                )}
              </p>
              <p className="text-xs text-zinc-500 italic dark:text-zinc-400">&ldquo;{fact.quote}&rdquo;</p>
              {openFactId === fact.id ? (
                <SourceExcerptView text={sourceText.get(fact.provenance.segmentId) ?? ""} quote={fact.quote} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Hinthia non ha trovato dati da ricavare in questo documento.
        </p>
      )}

      <p className="border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Ogni dato è stato controllato nel testo del documento: se la frase non c&apos;è, non compare.
        {coverage.truncated
          ? ` Il documento è molto lungo: sono state lette ${coverage.read} parti su ${coverage.total}.`
          : ""}
      </p>
    </section>
  );
}
