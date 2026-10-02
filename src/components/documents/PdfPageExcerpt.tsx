"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { highlightRects, locateQuote, type HighlightRect } from "@/domain/ai/analysis/page-highlight";
import { renderPdfPageWithText } from "@/lib/pdf";

type PageState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; imageUrl: string; rects: HighlightRect[]; located: boolean };

/**
 * La pagina originale del PDF, disegnata sul dispositivo, con la frase che prova il dato evidenziata. Il file
 * si decifra e si disegna qui: nulla esce dal dispositivo. Dove la pagina non si può disegnare (ambiente senza canvas,
 * file illeggibile) mostra `fallback`, il testo letto.
 */
export function PdfPageExcerpt({
  loadBytes,
  page,
  quote,
  fallback,
}: {
  loadBytes: () => Promise<Uint8Array>;
  page: number;
  quote: string;
  fallback: ReactNode;
}) {
  const [state, setState] = useState<PageState>({ status: "loading" });
  const markRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let imageUrl: string | null = null;

    (async () => {
      try {
        const rendered = await renderPdfPageWithText(await loadBytes(), page);
        if (cancelled) return;
        if (!rendered) {
          setState({ status: "unavailable" });
          return;
        }
        const spans = locateQuote(rendered.items, quote);
        const rects = spans
          ? highlightRects(rendered.items, spans, rendered.transform, rendered.width, rendered.height)
          : [];
        imageUrl = URL.createObjectURL(rendered.image);
        setState({ status: "ready", imageUrl, rects, located: rects.length > 0 });
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [loadBytes, page, quote]);

  useEffect(() => {
    if (state.status === "ready") markRef.current?.scrollIntoView?.({ block: "center" });
  }, [state]);

  if (state.status === "unavailable") return <>{fallback}</>;
  if (state.status === "loading") {
    return (
      <p role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
        Apro la pagina originale...
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        role="region"
        aria-label="Pagina originale"
        className="relative max-h-[32rem] overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800"
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- pagina disegnata sul dispositivo, object URL */}
          <img src={state.imageUrl} alt={`Pagina ${page} del documento`} className="block w-full" />
          {state.rects.map((rect, index) => (
            <div
              key={index}
              ref={index === 0 ? markRef : undefined}
              data-testid="page-highlight"
              aria-hidden
              className="pointer-events-none absolute rounded-sm bg-brand/30"
              style={{
                left: `${rect.left}%`,
                top: `${rect.top}%`,
                width: `${rect.width}%`,
                height: `${rect.height}%`,
              }}
            />
          ))}
        </div>
      </div>
      {state.located ? null : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Non riesco a indicare la frase sulla pagina (può essere una scansione): la trovi nel testo letto.
        </p>
      )}
    </div>
  );
}
